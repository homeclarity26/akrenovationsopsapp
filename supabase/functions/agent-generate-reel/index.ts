// K57: Generate progress reel agent
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
  project_id: z.string().uuid('project_id must be a valid UUID'),
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
        capability_required: 'curate_photos', query,
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

function uuidv4(): string {
  return crypto.randomUUID()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-generate-reel')
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
    const { project_id } = parsed.data
    const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
    if (!project) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: getCorsHeaders(req) })

    const { data: photos } = await supabase
      .from('project_photos')
      .select('id, image_url, category, ai_description, taken_at')
      .eq('project_id', project_id)
      .order('taken_at', { ascending: true })

    if (!photos || photos.length < 4) {
      return new Response(JSON.stringify({ error: 'not enough photos' }), { status: 400, headers: getCorsHeaders(req) })
    }

    const basePrompt = await callAssembleContext('agent-generate-reel', 'select photos for project reel')
    const systemPrompt = (basePrompt ??
      buildSystemPrompt(company, 'content creator'))
      + `\n\nREEL CURATOR\nSelect 12-20 photos that tell the story of the project. Mix of before/during/after.`

    const _t0 = Date.now()

    const { text: selection, usage: _u } = await callClaude(systemPrompt, `Select the best photos for a client progress reel for ${project.title}.
Photos: ${JSON.stringify(photos)}

Rules:
- 1-2 "before" demo/existing photos
- 3-4 "during" progress photos
- 4-6 "after" finished photos
- Avoid blurry or unflattering photos

Return: [{photo_id, order, caption, phase_label}]`)

    logAiUsage({ function_name: 'agent-generate-reel', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' }).catch(() => {})

    const galleryToken = uuidv4()

    await supabase.from('projects').update({
      reel_gallery_token: galleryToken,
      reel_generated_at: new Date().toISOString(),
    }).eq('id', project_id)

    await supabase.from('ai_actions').insert({
      request_text: `Progress reel for ${project.title}`,
      action_type: 'progress_reel_generated',
      action_data: { project_id, selection, galleryToken },
      requires_approval: true,
      risk_level: 'high',
      status: 'pending',
    })

    return new Response(JSON.stringify({ selection, galleryToken }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
