// K54: Inspection analyzer agent (Claude vision)
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
  inspection_id: z.string().uuid('inspection_id must be a valid UUID'),
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
        capability_required: 'analyze_photo', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

async function callClaudeVision(systemPrompt: string, userContent: any[], maxTokens = 1024): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
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
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-inspection-analyzer')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const rawBody = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { inspection_id } = parsed.data
    const { data: inspection } = await supabase.from('inspection_reports').select('*').eq('id', inspection_id).single()
    if (!inspection) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: getCorsHeaders(req) })

    const { data: project } = await supabase.from('projects').select('project_type, title').eq('id', inspection.project_id).single()

    const basePrompt = await callAssembleContext('agent-inspection-analyzer', 'analyze inspection photos')
    const systemPrompt = (basePrompt ??
      buildSystemPrompt(company, 'inspection specialist'))
      + `\n\nINSPECTION ANALYZER\nReview job-site photos. Identify issues, code concerns, quality problems.`

    const areas = (inspection.areas as any[]) ?? []
    const analyses = [] as any[]
    for (const area of areas) {
      try {
        const _tv = Date.now()
        const { text: result, usage: _uv } = await callClaudeVision(systemPrompt, [
          { type: 'image', source: { type: 'url', url: area.photo_url } },
          { type: 'text', text: `Photo of: ${area.area_name}
Inspector condition: ${area.condition}
Inspector notes: ${area.notes ?? ''}
Project type: ${project?.project_type}
Inspection stage: ${inspection.inspection_type}

Identify issues, code concerns, quality problems. Return JSON: {issues_found: [], quality_rating: 1-5, code_concerns: [], recommendation}` },
        ])
        logAiUsage({ function_name: 'agent-inspection-analyzer', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _uv.input_tokens, output_tokens: _uv.output_tokens, duration_ms: Date.now() - _tv, status: 'success' })
        analyses.push({ area: area.area_name, result })
      } catch (err) {
        analyses.push({ area: area.area_name, error: String(err) })
      }
    }

    const _tv = Date.now()

    const { text: summary, usage: _uv } = await callClaudeVision(systemPrompt, [
      { type: 'text', text: `Generate a professional inspection report summary for the ${inspection.inspection_type} inspection on ${project?.title}.
Findings: ${JSON.stringify(analyses)

    logAiUsage({ function_name: 'agent-inspection-analyzer', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _uv.input_tokens, output_tokens: _uv.output_tokens, duration_ms: Date.now() - _tv, status: 'success' })}
Write factually, like documentation for a client or insurance record.` },
    ], 2048)

    const flags = analyses.filter((a) => typeof a.result === 'string' && a.result.includes('issues_found'))

    await supabase.from('inspection_reports').update({
      ai_summary: summary,
      ai_flags: flags,
    }).eq('id', inspection_id)

    return new Response(JSON.stringify({ summary, analyses }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
