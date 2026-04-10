import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'

async function callAssembleContext(agentName: string, query: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'query_financials', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_CONFIG.PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return { text: data.content?.[0]?.text ?? '', usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } }
}

async function writeOutput(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  outputType: string,
  title: string,
  content: string,
  metadata?: Record<string, unknown>,
  requiresApproval = false,
) {
  await supabase.from('agent_outputs').insert({
    agent_name: agentName, output_type: outputType, title, content,
    metadata: metadata ?? null, requires_approval: requiresApproval,
  })
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function businessDaysSince(dateStr: string): number {
  const start = new Date(dateStr)
  const end = new Date()
  let count = 0
  const cur = new Date(start)
  while (cur < end) {
    if (isBusinessDay(cur)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-risk-monitor')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const basePrompt = await callAssembleContext('agent-risk-monitor', 'assess project health and risk')
    const systemPrompt =
      (basePrompt ??
        buildSystemPrompt(company, 'risk analyst')) +
      `

PROJECT RISK ASSESSMENT TASK
Given the project health data below, write a concise alert summary.
Include: what is at risk, why, and what Adam should do about it.
Be specific. Use the project name. No em dashes. 3-5 sentences max.`

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id,title,client_name,project_type,status,schedule_status,percent_complete,actual_cost,estimated_cost,target_completion_date,actual_start_date')
      .eq('status', 'active')

    if (error) throw error

    const projectIds = (projects ?? []).map((p) => p.id)

    const [{ data: allLogs }, { data: allPunchItems }] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('project_id,log_date')
        .in('project_id', projectIds)
        .order('log_date', { ascending: false }),
      supabase
        .from('punch_list_items')
        .select('project_id,created_at,status')
        .in('project_id', projectIds)
        .neq('status', 'complete'),
    ])

    const logsByProject = new Map<string, string[]>()
    for (const log of allLogs ?? []) {
      if (!logsByProject.has(log.project_id)) logsByProject.set(log.project_id, [])
      logsByProject.get(log.project_id)!.push(log.log_date)
    }

    const punchByProject = new Map<string, number>()
    for (const item of allPunchItems ?? []) {
      const ageDays = daysSince(item.created_at)
      if (ageDays >= 14) {
        punchByProject.set(item.project_id, (punchByProject.get(item.project_id) ?? 0) + 1)
      }
    }

    const alerts: Array<{ project: (typeof projects)[0]; score: number; issues: string[] }> = []

    for (const project of projects ?? []) {
      let score = 100
      const issues: string[] = []

      // Schedule check
      if (project.target_completion_date) {
        const daysUntilDue = Math.floor(
          (new Date(project.target_completion_date).getTime() - Date.now()) / 86400000,
        )
        const pctRemaining = 100 - (project.percent_complete ?? 0)
        if (daysUntilDue < 7 && pctRemaining > 20) {
          score -= 25
          issues.push(`Only ${daysUntilDue} days until target completion but ${pctRemaining}% work remains`)
        } else if (daysUntilDue < 0) {
          score -= 30
          issues.push(`Past target completion date by ${Math.abs(daysUntilDue)} days`)
        }
      }

      // Budget check
      if (project.estimated_cost && project.actual_cost) {
        const ratio = project.actual_cost / project.estimated_cost
        if (ratio > 1.1) {
          const overPct = Math.round((ratio - 1) * 100)
          score -= 20
          issues.push(`Actual cost is ${overPct}% over budget ($${project.actual_cost.toLocaleString()} vs $${project.estimated_cost.toLocaleString()} estimated)`)
        }
      }

      // Activity check
      const projectLogs = logsByProject.get(project.id) ?? []
      const mostRecentLog = projectLogs[0]
      if (!mostRecentLog) {
        score -= 15
        issues.push('No daily logs on record for this project')
      } else {
        const businessDaysWithoutLog = businessDaysSince(mostRecentLog)
        if (businessDaysWithoutLog >= 3) {
          score -= 15
          issues.push(`No daily log in ${businessDaysWithoutLog} business days (last log: ${mostRecentLog})`)
        }
      }

      // Punch list check
      const stalePunchCount = punchByProject.get(project.id) ?? 0
      if (stalePunchCount > 0) {
        score -= 10
        issues.push(`${stalePunchCount} punch list item(s) open for 14+ days`)
      }

      if (issues.length > 0) {
        alerts.push({ project, score, issues })
      }

      // Update schedule_status
      let newStatus = 'on_track'
      if (score < 50) newStatus = 'behind'
      else if (score < 70) newStatus = 'at_risk'

      if (newStatus !== project.schedule_status) {
        await supabase
          .from('projects')
          .update({ schedule_status: newStatus })
          .eq('id', project.id)
      }
    }

    // Write alerts for at-risk and behind projects
    for (const { project, score, issues } of alerts) {
      const statusLabel = score < 50 ? 'Behind' : 'At Risk'
      const _t0 = Date.now()
      const { text: alertText, usage: _u } = await callClaude(
        systemPrompt,
        `Project: ${project.title} (${project.client_name})
      logAiUsage({ function_name: 'agent-risk-monitor', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })
Health Score: ${score}/100 (${statusLabel})
Issues Found:
${issues.map((i) => `- ${i}`).join('\n')}

Write the alert summary for Adam.`,
        300,
      )

      await writeOutput(
        supabase,
        'agent-risk-monitor',
        'alert',
        `${statusLabel}: ${project.title}`,
        alertText,
        {
          project_id: project.id,
          project_title: project.title,
          client_name: project.client_name,
          score,
          issues,
          new_status: score < 50 ? 'behind' : 'at_risk',
        },
        false,
      )
    }

    return new Response(
      JSON.stringify({ success: true, projects_checked: projects?.length ?? 0, alerts_generated: alerts.length }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-risk-monitor error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
