// PR 19 / Wave B: Generate a progress reel manifest for a project.
//
// Not a real video — for this first pass we produce a photo manifest plus a
// short AI-written narrative tying the photos together. The frontend renders
// it as a sequential gallery with the narrative pinned above.
//
// Input:  { project_id: uuid }
// Output: { reel_id, manifest, narrative }
//
// Admin-only. Uses the primary Claude model. Rate-limited.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const FUNCTION_NAME = 'generate-progress-reel'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
})

// Categories we consider "reel-worthy" — the visual story of the job.
const REEL_CATEGORIES = ['demo', 'rough_in', 'progress', 'finish', 'before_after']

interface ManifestPhoto {
  url: string
  caption: string | null
  taken_at: string | null
  category: string | null
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; input_tokens: number; output_tokens: number }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_CONFIG.PRIMARY_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return {
    text: data.content?.[0]?.text ?? '',
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
  if (auth.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }

  const rl = await checkRateLimit(req, FUNCTION_NAME)
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_id } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Load project context for the narrative prompt.
    const { data: project } = await supabase
      .from('projects')
      .select('id, title, client_name, project_type, company_id')
      .eq('id', project_id)
      .single()
    if (!project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Pull all visible, reel-eligible photos in chronological order.
    const { data: photos } = await supabase
      .from('project_photos')
      .select('id, image_url, caption, taken_at, category')
      .eq('project_id', project_id)
      .eq('visible_to_client', true)
      .in('category', REEL_CATEGORIES)
      .order('taken_at', { ascending: true })

    const selected = (photos ?? []) as Array<{
      image_url: string
      caption: string | null
      taken_at: string | null
      category: string | null
    }>

    if (selected.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Not enough client-visible photos to build a reel yet. Tag at least two progress photos as visible to client.',
        }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const manifest: { project_id: string; title: string; generated_at: string; photos: ManifestPhoto[] } = {
      project_id,
      title: `${project.title} — Progress Reel`,
      generated_at: new Date().toISOString(),
      photos: selected.map((p) => ({
        url: p.image_url,
        caption: p.caption,
        taken_at: p.taken_at,
        category: p.category,
      })),
    }

    // Build the 2-paragraph narrative. One Claude call, short prompt.
    const systemPrompt =
      `You are a warm, plain-spoken contractor writing a short progress recap for a homeowner. ` +
      `Tie together the phases shown in their project's photos into two short paragraphs (4-6 sentences each). ` +
      `Paragraph 1: the story so far (demo, rough-in, progress). ` +
      `Paragraph 2: what the finish looks like and any final touches. ` +
      `Do not invent details. Keep it human, specific, and brief.`

    const photoSummary = selected
      .map((p, i) => `${i + 1}. [${p.category ?? 'photo'}] ${p.caption ?? '(no caption)'}`)
      .join('\n')
    const userMessage =
      `Project: ${project.title}\n` +
      `Client: ${project.client_name ?? 'the homeowner'}\n` +
      `Type: ${project.project_type ?? 'renovation'}\n\n` +
      `Photos in order:\n${photoSummary}\n\n` +
      `Write the two-paragraph recap now.`

    const t0 = Date.now()
    let narrative = ''
    try {
      const result = await callClaude(systemPrompt, userMessage)
      narrative = result.text.trim()
      logAiUsage({
        company_id: project.company_id ?? undefined,
        function_name: FUNCTION_NAME,
        model_provider: 'anthropic',
        model_name: AI_CONFIG.PRIMARY_MODEL,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        duration_ms: Date.now() - t0,
        status: 'success',
      }).catch(() => {})
    } catch (err) {
      // Narrative is best-effort — still ship the manifest if AI failed.
      logAiUsage({
        company_id: project.company_id ?? undefined,
        function_name: FUNCTION_NAME,
        model_provider: 'anthropic',
        model_name: AI_CONFIG.PRIMARY_MODEL,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - t0,
        status: 'error',
        error_message: String(err),
      }).catch(() => {})
      narrative = ''
    }

    // Persist the reel so the UI can keep showing it and flip visibility later.
    const { data: reel, error: insertErr } = await supabase
      .from('project_reels')
      .insert({
        project_id,
        generated_by: auth.user_id,
        title: manifest.title,
        manifest,
        narrative: narrative || null,
        visible_to_client: false,
      })
      .select('id')
      .single()

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: `Could not save reel: ${insertErr.message}` }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        reel_id: reel.id,
        manifest,
        narrative,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
