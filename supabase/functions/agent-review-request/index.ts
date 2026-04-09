import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-review-request')
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { project_id } = parsedInput.data

    const basePrompt = await callAssembleContext('agent-review-request', 'generate personalized review request for completed project')
    const systemPrompt =
      (basePrompt ??
        'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio. Adam Kilgore is the owner.') +
      `

REVIEW REQUEST TASK
Write a warm, personal review request message from Adam Kilgore to the client.
Reference the specific project type (kitchen remodel, bathroom renovation, etc.).
Ask them to leave a Google review. Include a placeholder [REVIEW_LINK] for the Google Business link.
Tone: grateful, genuine, not pushy. Like a craftsman who takes pride in their work.
Length: 3-4 sentences. No em dashes.`

    const { data: project, error } = await supabase
      .from('projects')
      .select('id,title,project_type,client_name,client_email,client_phone,actual_completion_date')
      .eq('id', project_id)
      .single()

    if (error || !project) throw error ?? new Error('Project not found')

    // Check if a review request already exists for this project
    const { data: existingReview } = await supabase
      .from('review_requests')
      .select('id')
      .eq('project_id', project_id)
      .neq('status', 'skipped')
      .single()

    if (existingReview) {
      return new Response(
        JSON.stringify({ success: false, message: 'Review request already exists for this project' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const messageDraft = await callClaude(
      systemPrompt,
      `Client: ${project.client_name}
Project Type: ${project.project_type}
Project Title: ${project.title}
Completion Date: ${project.actual_completion_date ?? 'recently completed'}

Draft the review request message.`,
      350,
    )

    // Create review_request record
    await supabase.from('review_requests').insert({
      project_id,
      platform: 'google',
      status: 'pending',
      delay_days: 7,
    })

    await supabase.from('ai_actions').insert({
      request_text: `Send Google review request to ${project.client_name} for ${project.title}`,
      action_type: 'send_sms_or_email',
      action_data: {
        project_id,
        client_name: project.client_name,
        client_email: project.client_email,
        client_phone: project.client_phone,
        message: messageDraft,
        platform: 'google',
        subject: 'We hope you love your new space',
      },
      requires_approval: true,
      risk_level: 'medium',
      status: 'pending',
    })

    return new Response(
      JSON.stringify({ success: true, client_name: project.client_name, message_draft: messageDraft }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-review-request error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
