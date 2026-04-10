// K6: Crew schedule optimizer agent
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  week_start: z.string().optional(),
})

async function callAssembleContext(agentName: string, query: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'query_schedule', query,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-schedule-optimizer')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const basePrompt = await callAssembleContext('agent-schedule-optimizer', 'optimize the crew schedule for this week')
    const systemPrompt = (basePrompt ??
      buildSystemPrompt(company, 'scheduling assistant'))
      + `\n\nSCHEDULE OPTIMIZER TASK\nReview crew schedule and project status. Suggest optimal crew assignments. Consider time-sensitive phases, employee strengths, inspections, and sub coordination.`

    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { week_start } = parsedInput.data
    const weekStart = week_start ?? new Date().toISOString().split('T')[0]

    const { data: projects } = await supabase.from('projects').select('id,title,status,current_phase,target_completion_date').eq('status', 'active')
    const { data: employees } = await supabase.from('profiles').select('id,full_name,role').eq('role', 'employee').eq('is_active', true)
    const { data: events } = await supabase.from('schedule_events').select('*').gte('start_date', weekStart)

    const _t0 = Date.now()

    const { text: suggestion, usage: _u } = await callClaude(systemPrompt, `Week starting: ${weekStart}
Active projects: ${JSON.stringify(projects)

    logAiUsage({ function_name: 'agent-schedule-optimizer', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })}
Employees: ${JSON.stringify(employees)}
Existing schedule events: ${JSON.stringify(events)}

Jeff strengths: cabinet install, trim carpentry, tile.
Steven strengths: finish carpentry, fixtures, tile.
Adam: PM commitments and field days.

Return JSON: [{employee_id, project_id, day, notes}]`)

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
