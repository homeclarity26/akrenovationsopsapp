import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  lead_id: z.string().uuid('lead_id must be a valid UUID'),
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

function scoreLead(lead: Record<string, unknown>): number {
  let score = 50 // base

  // Project type match (AK Renovations focuses on kitchens, baths, additions, basements)
  const highValueTypes = ['kitchen', 'addition', 'first_floor', 'basement']
  const medValueTypes = ['bathroom', 'other']
  if (highValueTypes.some((t) => (lead.project_type as string)?.toLowerCase().includes(t))) score += 20
  else if (medValueTypes.some((t) => (lead.project_type as string)?.toLowerCase().includes(t))) score += 10

  // Location (Summit County = ideal, but all Ohio is OK)
  const address = ((lead.address as string) ?? '').toLowerCase()
  const city = ((lead.city as string) ?? '').toLowerCase()
  const summitCities = ['akron', 'stow', 'hudson', 'tallmadge', 'cuyahoga falls', 'barberton', 'green', 'norton', 'twinsburg', 'aurora']
  if (summitCities.some((c) => city.includes(c) || address.includes(c))) score += 15
  else if ((lead.state as string) === 'OH') score += 5

  // Estimated value
  const val = (lead.estimated_value as number) ?? 0
  if (val >= 80000) score += 15
  else if (val >= 40000) score += 10
  else if (val >= 20000) score += 5

  // Source quality
  const source = lead.source as string
  if (source === 'referral') score += 10
  else if (source === 'google_ads' || source === 'website') score += 5

  return Math.min(score, 100)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-lead-intake')
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
    const { lead_id } = parsed.data

    const basePrompt = await callAssembleContext('agent-lead-intake', 'score new lead and draft acknowledgment response')
    const ackSystemPrompt =
      (basePrompt ??
        'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio. Adam Kilgore is the owner.') +
      `

LEAD ACKNOWLEDGMENT TASK
Write a warm, personal initial response to a new inquiry. Write as Adam Kilgore.
Acknowledge their project interest, confirm you received their message, and tell them you will be in touch within 24 hours to discuss.
If they mentioned a project type, reference it specifically.
Keep it to 3-4 sentences. Conversational and professional. No em dashes.`

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) throw leadError ?? new Error('Lead not found')

    const score = scoreLead(lead)

    const ackMessage = await callClaude(
      ackSystemPrompt,
      `New lead: ${lead.full_name}
Project type: ${lead.project_type ?? 'home renovation'}
Project description: ${lead.project_description ?? 'not specified'}
Source: ${lead.source ?? 'website'}
Location: ${lead.city ?? ''}, ${lead.state ?? 'OH'}

Draft the acknowledgment message.`,
      300,
    )

    // Log the acknowledgment as a lead activity
    await supabase.from('lead_activities').insert({
      lead_id,
      activity_type: 'ai_action',
      description: `AI scored lead ${score}/100 and drafted acknowledgment response`,
      metadata: {
        score,
        acknowledgment_message: ackMessage,
        scoring_breakdown: {
          project_type: lead.project_type,
          location: lead.city,
          estimated_value: lead.estimated_value,
          source: lead.source,
        },
      },
      created_by: null,
    })

    // Create follow-up task for Adam
    await supabase.from('tasks').insert({
      project_id: null,
      assigned_to: null, // Will be assigned to Adam's profile ID — left null for now
      title: `Follow up with new lead: ${lead.full_name}`,
      description: `New ${lead.project_type ?? 'renovation'} inquiry from ${lead.full_name}. Lead score: ${score}/100. Project: ${lead.project_description ?? 'not described'}`,
      due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
      status: 'todo',
    })

    // Simulate sending acknowledgment (high risk — requires approval before actual send)
    await supabase.from('ai_actions').insert({
      request_text: `Send acknowledgment to new lead ${lead.full_name}`,
      action_type: 'send_sms_or_email',
      action_data: {
        lead_id,
        recipient_name: lead.full_name,
        recipient_email: lead.email,
        recipient_phone: lead.phone,
        message: ackMessage,
        lead_score: score,
      },
      requires_approval: true,
      risk_level: 'high',
      status: 'pending',
    })

    // Update lead with score in notes
    await supabase
      .from('leads')
      .update({
        notes: `${lead.notes ? lead.notes + '\n\n' : ''}[AI Lead Score: ${score}/100 — ${new Date().toLocaleDateString()}]`,
        next_action: 'Call to discuss project',
        next_action_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      })
      .eq('id', lead_id)

    return new Response(
      JSON.stringify({
        success: true,
        lead_score: score,
        acknowledgment_message: ackMessage,
        task_created: true,
        requires_approval: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-lead-intake error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
