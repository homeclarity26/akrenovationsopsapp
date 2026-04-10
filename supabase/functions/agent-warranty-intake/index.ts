// K39: Warranty intake agent
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  claim_id: z.string().uuid('claim_id must be a valid UUID'),
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
        capability_required: 'analyze_warranty', query,
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

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-warranty-intake')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { claim_id } = parsedInput.data
    const { data: claim } = await supabase.from('warranty_claims').select('*').eq('id', claim_id).single()
    if (!claim) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: getCorsHeaders(req) })

    const { data: project } = await supabase.from('projects').select('*').eq('id', claim.project_id).single()
    const { data: subs } = await supabase.from('project_subcontractors').select('*, subcontractors(*)').eq('project_id', claim.project_id)

    const basePrompt = await callAssembleContext('agent-warranty-intake', 'analyze warranty claim responsibility')
    const systemPrompt = (basePrompt ??
      'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.')
      + `\n\nWARRANTY INTAKE\nAnalyze warranty claims, determine responsible trade, draft client and sub responses.`

    const _t0 = Date.now()

    const { text: analysis, usage: _u } = await callClaude(systemPrompt, `Warranty claim for completed project.
Claim: ${claim.description}
Project: ${project?.title}
Project type: ${project?.project_type}
Completion date: ${project?.actual_completion_date}
Subcontractors: ${JSON.stringify(subs)

    logAiUsage({ function_name: 'agent-warranty-intake', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })}

Determine:
1. Likely responsible trade/sub
2. Workmanship issue or normal wear?
3. Within 12-month warranty?
4. Recommended next steps
5. Draft client acknowledgement
6. If sub responsible, draft sub notification

Return JSON.`)

    await supabase.from('warranty_claims').update({
      resolution: analysis,
    }).eq('id', claim_id)

    await supabase.from('ai_actions').insert({
      request_text: `Warranty claim: ${claim.description?.substring(0, 80)}`,
      action_type: 'warranty_analysis',
      action_data: { claim_id, analysis },
      requires_approval: true,
      risk_level: 'high',
      status: 'pending',
    })

    return new Response(JSON.stringify({ analysis }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
