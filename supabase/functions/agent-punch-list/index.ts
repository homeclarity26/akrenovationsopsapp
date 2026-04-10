import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
})

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
      model: 'claude-sonnet-4-20250514',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-punch-list')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_id } = parsed.data

    const basePrompt = await callAssembleContext('agent-punch-list', 'compile punch list items from project data')
    const systemPrompt =
      (basePrompt ?? 'You are an AI project manager for AK Renovations, a high-end residential remodeling contractor.') +
      `

PUNCH LIST COMPILATION TASK
Based on the project data provided, generate a comprehensive punch list.
Group items by room or area.
Each item should be a specific, actionable task for the crew.
Items should cover: cosmetic touchups, hardware installation, cleaning, adjustments, inspections needed.
Format as a JSON array of objects: [{"description": "specific task", "location": "room/area"}]
Return ONLY the JSON array.`

    const [
      { data: project },
      { data: recentLogs },
      { data: issuePhotos },
      { data: openTasks },
      { data: proposal },
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('id,title,project_type,client_name,current_phase,percent_complete')
        .eq('id', project_id)
        .single(),
      supabase
        .from('daily_logs')
        .select('log_date,summary,work_completed,issues')
        .eq('project_id', project_id)
        .order('log_date', { ascending: false })
        .limit(10),
      supabase
        .from('project_photos')
        .select('ai_description,ai_tags,caption,category')
        .eq('project_id', project_id)
        .eq('category', 'issue')
        .not('ai_description', 'is', null),
      supabase
        .from('tasks')
        .select('title,description,status')
        .eq('project_id', project_id)
        .neq('status', 'done'),
      supabase
        .from('proposals')
        .select('sections,overview_body')
        .eq('project_id', project_id)
        .in('status', ['accepted', 'sent'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    if (!project) throw new Error('Project not found')

    // Extract issues mentioned in daily logs
    const issuesFromLogs = (recentLogs ?? [])
      .filter((l) => l.issues && l.issues.toLowerCase() !== 'none')
      .map((l) => `${l.log_date}: ${l.issues}`)
      .join('\n')

    // Extract issues from photos
    const issuesFromPhotos = (issuePhotos ?? [])
      .map((p) => p.ai_description ?? p.caption ?? '')
      .filter(Boolean)
      .join('\n')

    const compilationPrompt = `Project: ${project.title} (${project.project_type} for ${project.client_name})
Current Phase: ${project.current_phase ?? 'Near Completion'}
Percent Complete: ${project.percent_complete}%

Project Scope Summary:
${proposal?.overview_body ?? 'Standard ' + project.project_type + ' renovation'}

Issues Noted in Daily Logs:
${issuesFromLogs || 'None recorded'}

Issues Visible in Photos:
${issuesFromPhotos || 'None flagged'}

Open Tasks:
${(openTasks ?? []).map((t) => t.title).join('\n') || 'None'}

Based on this data and the typical punch list for a ${project.project_type} renovation, generate the punch list items as a JSON array.`

    const _t0 = Date.now()

    const { text: punchListResult, usage: _u } = await callClaude(systemPrompt, compilationPrompt, 1200)

    logAiUsage({ function_name: 'agent-punch-list', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })

    let punchListItems: Array<{ description: string; location: string }> = []
    try {
      const jsonText = punchListResult.replace(/```json\n?|\n?```/g, '').trim()
      punchListItems = JSON.parse(jsonText)
      if (!Array.isArray(punchListItems)) punchListItems = []
    } catch {
      const jsonMatch = punchListResult.match(/\[[\s\S]+\]/)
      if (jsonMatch) {
        try { punchListItems = JSON.parse(jsonMatch[0]) } catch { punchListItems = [] }
      }
    }

    // Check for existing open punch list items to avoid duplicates
    const { data: existingItems } = await supabase
      .from('punch_list_items')
      .select('description')
      .eq('project_id', project_id)
      .eq('status', 'open')

    const existingDescriptions = new Set(
      (existingItems ?? []).map((i) => i.description.toLowerCase().substring(0, 30)),
    )

    // Filter out likely duplicates and insert new items
    const newItems = punchListItems.filter((item) => {
      const key = item.description.toLowerCase().substring(0, 30)
      return !existingDescriptions.has(key)
    })

    let insertedCount = 0
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i]
      const { error: insertError } = await supabase.from('punch_list_items').insert({
        project_id,
        description: item.description,
        location: item.location ?? null,
        status: 'open',
        sort_order: (existingItems?.length ?? 0) + i,
      })
      if (!insertError) insertedCount++
    }

    const summaryText = `Punch list compiled for ${project.title}.\n${insertedCount} new items added across ${[...new Set(newItems.map((i) => i.location))].length} areas.\n\nItems by area:\n${Object.entries(
      newItems.reduce((acc: Record<string, string[]>, item) => {
        const loc = item.location ?? 'General'
        if (!acc[loc]) acc[loc] = []
        acc[loc].push(item.description)
        return acc
      }, {}),
    )
      .map(([area, items]) => `${area}:\n${items.map((d) => `  - ${d}`).join('\n')}`)
      .join('\n\n')}`

    await writeOutput(
      supabase,
      'agent-punch-list',
      'report',
      `Punch List: ${project.title}`,
      summaryText,
      {
        project_id,
        project_title: project.title,
        items_added: insertedCount,
        total_items: punchListItems.length,
        areas: [...new Set(newItems.map((i) => i.location ?? 'General'))],
      },
      false,
    )

    return new Response(
      JSON.stringify({
        success: true,
        items_generated: punchListItems.length,
        items_added: insertedCount,
        items: newItems,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-punch-list error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
