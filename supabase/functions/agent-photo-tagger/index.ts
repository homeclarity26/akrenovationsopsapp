import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  photo_id: z.string().uuid('photo_id must be a valid UUID'),
  image_url: z.string().url('image_url must be a valid URL'),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<string> {
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
  return data.content?.[0]?.text ?? ''
}

async function callClaudeVision(systemPrompt: string, imageUrl: string, userMessage: string, maxTokens = 800): Promise<string> {
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: userMessage },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Claude vision error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-photo-tagger')
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { photo_id, image_url } = parsed.data

    await callAssembleContext('agent-photo-tagger', 'analyze construction photo and generate tags and description')

    const systemPrompt = `You are an AI photo analyst for AK Renovations, a residential remodeling contractor.
Analyze this construction photo and return ONLY a valid JSON object:
{
  "description": "1-2 sentence description of what is shown in the photo, written for a homeowner",
  "tags": ["list", "of", "relevant", "tags"],
  "phase": "demo|framing|rough_in|insulation|drywall|tile|flooring|cabinets|countertop|fixtures|painting|trim|finish|cleanup",
  "room": "kitchen|bathroom|bedroom|living_room|basement|garage|exterior|other",
  "quality_score": 1-5,
  "has_issue": true or false,
  "issue_description": "description of any visible problem, defect, damage, or safety concern, or null if none",
  "is_client_shareable": true or false
}
Return ONLY the JSON.`

    const visionResult = await callClaudeVision(
      systemPrompt,
      image_url,
      'Analyze this construction photo and return JSON.',
      700,
    )

    let photoAnalysis: Record<string, unknown> = {}
    try {
      photoAnalysis = JSON.parse(visionResult.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = visionResult.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try { photoAnalysis = JSON.parse(jsonMatch[0]) } catch { photoAnalysis = { description: visionResult } }
      }
    }

    // Update photo record
    await supabase
      .from('project_photos')
      .update({
        ai_description: photoAnalysis.description as string ?? null,
        ai_tags: photoAnalysis,
        phase: photoAnalysis.phase as string ?? null,
      })
      .eq('id', photo_id)

    // If issue detected, create an alert
    if (photoAnalysis.has_issue) {
      const { data: photo } = await supabase
        .from('project_photos')
        .select('project_id')
        .eq('id', photo_id)
        .single()

      if (photo?.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('title,client_name')
          .eq('id', photo.project_id)
          .single()

        await supabase.from('ai_actions').insert({
          request_text: `Photo issue detected on ${project?.title ?? 'unknown project'}: ${photoAnalysis.issue_description}`,
          action_type: 'flag_issue',
          action_data: {
            photo_id,
            project_id: photo.project_id,
            project_title: project?.title,
            image_url,
            issue_description: photoAnalysis.issue_description,
            ai_tags: photoAnalysis,
          },
          requires_approval: true,
          risk_level: 'medium',
          status: 'pending',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        photo_id,
        analysis: photoAnalysis,
        issue_flagged: photoAnalysis.has_issue === true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-photo-tagger error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
