import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  change_order_id: z.string().uuid('change_order_id must be a valid UUID').optional(),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  flag_description: z.string().optional(),
  flag_photos: z.array(z.string()).optional(),
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

  const rl = await checkRateLimit(req, 'agent-change-order-drafter')
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
    const { change_order_id, project_id, flag_description, flag_photos } = parsed.data
    if (!change_order_id && !project_id) {
      return new Response(JSON.stringify({ error: 'change_order_id or project_id required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const basePrompt = await callAssembleContext('agent-change-order-drafter', 'draft formal change order from field flag')
    const systemPrompt =
      (basePrompt ?? 'You are an AI contracts assistant for AK Renovations, a high-end residential remodeling contractor.') +
      `

CHANGE ORDER DRAFTING TASK
Write a formal, professional change order description for the client.
Include:
1. Title (concise, 5-8 words)
2. Scope Change Description (what is being added/modified and why — 2-3 sentences)
3. Reason (why this change was needed — existing conditions, client request, code requirement, etc.)

Write in clear, plain English that a homeowner would understand.
Be specific about what work is involved. No em dashes.`

    let changeOrder: Record<string, unknown> | null = null
    let project: { id: string; title: string; project_type: string; client_name: string } | null = null

    if (change_order_id) {
      const { data: co, error: coError } = await supabase
        .from('change_orders')
        .select('id,project_id,title,description,flagged_by,flagged_at,flagged_photos,scope_change,cost_change,schedule_change_days,status')
        .eq('id', change_order_id)
        .single()

      if (coError || !co) throw coError ?? new Error('Change order not found')
      changeOrder = co

      const { data: proj } = await supabase
        .from('projects')
        .select('id,title,project_type,client_name')
        .eq('id', co.project_id)
        .single()
      project = proj
    } else {
      const { data: proj } = await supabase
        .from('projects')
        .select('id,title,project_type,client_name')
        .eq('id', project_id)
        .single()
      project = proj
    }

    if (!project) throw new Error('Project not found')

    // Get project scope from most recent proposal
    const { data: proposal } = await supabase
      .from('proposals')
      .select('sections,overview_body')
      .eq('project_id', project.id)
      .in('status', ['accepted', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const flagDesc = (changeOrder?.description as string) ?? flag_description ?? 'No description provided'
    const photos = (changeOrder?.flagged_photos as string[]) ?? flag_photos ?? []

    const draftPrompt = `Project: ${project.title} (${project.client_name})
Project Type: ${project.project_type}
Original Scope Summary: ${proposal?.overview_body ?? 'Not available'}
Field Flag / Issue Described: ${flagDesc}
Number of Photos Attached: ${photos.length}

Draft the formal change order content (title + scope description + reason).`

    const _t0 = Date.now()

    const { text: draftContent, usage: _u } = await callClaude(systemPrompt, draftPrompt, 600)

    logAiUsage({ function_name: 'agent-change-order-drafter', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })

    // Parse title from draft
    const titleMatch = draftContent.match(/^(?:title[:\s]+)?(.+?)(?:\n|$)/im)
    const draftTitle = titleMatch?.[1]?.replace(/^[*_#\s]+|[*_#\s]+$/g, '').trim() ?? `Change Order — ${project.title}`

    if (change_order_id && changeOrder) {
      // Update existing change order
      await supabase
        .from('change_orders')
        .update({
          title: draftTitle,
          scope_change: draftContent,
          status: 'draft',
        })
        .eq('id', change_order_id)
    } else {
      // Create new change order
      const { data: newCo } = await supabase
        .from('change_orders')
        .insert({
          project_id: project.id,
          title: draftTitle,
          description: flagDesc,
          flagged_photos: photos,
          scope_change: draftContent,
          status: 'draft',
        })
        .select()
        .single()

      changeOrder = newCo
    }

    await writeOutput(
      supabase,
      'agent-change-order-drafter',
      'draft',
      `Change Order Draft: ${draftTitle}`,
      draftContent,
      {
        change_order_id: change_order_id ?? changeOrder?.id,
        project_id: project.id,
        project_title: project.title,
        client_name: project.client_name,
        photo_count: photos.length,
      },
      true,
    )

    return new Response(
      JSON.stringify({
        success: true,
        change_order_id: change_order_id ?? changeOrder?.id,
        draft_title: draftTitle,
        draft_content: draftContent,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-change-order-drafter error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
