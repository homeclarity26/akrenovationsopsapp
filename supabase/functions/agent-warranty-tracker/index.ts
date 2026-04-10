import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const rl = await checkRateLimit(req, 'agent-warranty-tracker')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-warranty-tracker', 'draft warranty check-in emails for clients')
    const systemPrompt =
      (basePrompt ??
        'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.') +
      `

WARRANTY CHECK-IN EMAIL TASK
Write a warm, personal email from Adam Kilgore to the client.
Context depends on timing:
- 90-day mark: casual check-in, hope they are enjoying the space, reminder that warranty covers defects for another 9 months, invite any questions or concerns.
- 30-day mark: friendly heads-up that their 1-year warranty is expiring in a month, encourage them to do a walkthrough and note anything they want looked at before the warranty ends.
Both emails: professional, caring, 3-4 sentences. No em dashes.`

    const today = new Date()
    const in30Days = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
    const in90Days = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0]
    const in100Days = new Date(today.getTime() + 100 * 86400000).toISOString().split('T')[0]

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id,title,project_type,client_name,client_email,client_phone,warranty_expiry,actual_completion_date')
      .eq('status', 'complete')
      .not('warranty_expiry', 'is', null)

    if (error) throw error

    const actionsCreated: string[] = []

    for (const project of projects ?? []) {
      const expiry = project.warranty_expiry
      const daysUntilExpiry = Math.floor((new Date(expiry).getTime() - today.getTime()) / 86400000)

      // 90-day window: expiry is between 90 and 100 days out (so we send once in that window)
      const is90Day = expiry >= in90Days && expiry <= in100Days
      // 30-day window: expiry is within 30 days
      const is30Day = expiry >= today.toISOString().split('T')[0] && expiry <= in30Days

      if (!is90Day && !is30Day) continue

      const milestone = is30Day ? '30-day expiry warning' : '90-day check-in'

      const _t0 = Date.now()

      const { text: emailDraft, usage: _u } = await callClaude(
        systemPrompt,
        `Client: ${project.client_name}
Project: ${project.title}
Project Type: ${project.project_type}
Completed: ${project.actual_completion_date ?? 'recently'}
Warranty Expiry: ${expiry}
Days Until Expiry: ${daysUntilExpiry}
Milestone: ${milestone}

Draft the warranty email.`,
        350,
      )

      logAiUsage({ function_name: 'agent-warranty-tracker', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })

      await supabase.from('ai_actions').insert({
        request_text: `Warranty ${milestone} for ${project.client_name} — ${project.title} (expires ${expiry})`,
        action_type: 'send_email',
        action_data: {
          project_id: project.id,
          client_name: project.client_name,
          client_email: project.client_email,
          client_phone: project.client_phone,
          subject: is30Day ? `Your AK Renovations Warranty Expires Soon` : `Checking In on Your ${project.project_type} Remodel`,
          body: emailDraft,
          warranty_expiry: expiry,
          days_until_expiry: daysUntilExpiry,
          milestone,
        },
        requires_approval: true,
        risk_level: 'medium',
        status: 'pending',
      })

      actionsCreated.push(`${project.client_name} — ${milestone} (expires ${expiry})`)
    }

    return new Response(
      JSON.stringify({ success: true, actions_created: actionsCreated.length, projects: actionsCreated }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-warranty-tracker error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
