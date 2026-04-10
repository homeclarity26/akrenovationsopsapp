// N26: suggest-deliverable-items
// Called from the "Ask AI to suggest items" button on any EditableDeliverable.
// Returns 3-5 suggested additions specific to the project context.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  deliverableType: z.string(),
  currentItems: z.unknown().optional(),
  projectContext: z.record(z.unknown()),
})

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const anthropicKey = () => Deno.env.get('ANTHROPIC_API_KEY') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const rl = await checkRateLimit(req, 'suggest-deliverable-items')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { deliverableType, currentItems, projectContext } = parsedInput.data

    const supabase = createClient(supabaseUrl(), serviceKey())

    // Get business context for the system prompt
    const contextRes = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context_type: 'general', project_id: projectContext.project_id }),
    })

    const contextData = contextRes.ok ? await contextRes.json() : {}
    const systemPrompt = contextData.system_prompt ?? 'You are the AI assistant for AK Renovations, a high-end residential remodeling contractor.'

    const deliverableLabels: Record<string, string> = {
      checklist: 'project checklist',
      scope: 'subcontractor scope of work',
      proposal: 'proposal scope section',
      punch_list: 'punch list',
      shopping_list: 'shopping / materials list',
      inspection_form: 'inspection form',
      payment_schedule: 'payment milestone schedule',
    }

    const deliverableLabel = deliverableLabels[deliverableType] ?? deliverableType

    const userMessage = `You are helping edit a ${deliverableLabel} for an AK Renovations project.

Project details:
${JSON.stringify(projectContext, null, 2)}

Current items in the ${deliverableLabel}:
${JSON.stringify(currentItems, null, 2)}

Suggest 3-5 additional items that would improve this ${deliverableLabel} for this specific project.

Consider:
- The project type, scope, and any available client details
- What is already in the list (do NOT duplicate)
- What commonly gets missed on similar ${deliverableLabel.split(' ')[0]} projects
- Any project-specific details that warrant special attention

Return ONLY valid JSON — an array of objects:
[
  {"title": "...", "description": "...", "rationale": "..."},
  ...
]

Only suggest genuinely useful items. No filler.`

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!aiResp.ok) {
      throw new Error(`Claude API error: ${aiResp.status}`)
    }

    const aiData = await aiResp.json()
    const rawText = aiData.content?.[0]?.text ?? '[]'

    // Parse the JSON array from Claude's response
    let suggestions = []
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch {
      suggestions = []
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[suggest-deliverable-items]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
