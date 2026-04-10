// K44: Referral intake agent
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  referred_name: z.string(),
  referred_phone: z.string().optional(),
  referred_email: z.string().email('referred_email must be a valid email').optional(),
  project_type: z.string().optional(),
  referrer_lead_id: z.string().uuid('referrer_lead_id must be a valid UUID').optional(),
  referring_client_name: z.string().optional(),
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'process_referral', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
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
  return data.content?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-referral-intake')
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { referred_name, referred_phone, referred_email, project_type, referrer_lead_id, referring_client_name } = parsed.data

    // Create the lead
    const { data: lead } = await supabase.from('leads').insert({
      full_name: referred_name,
      phone: referred_phone,
      email: referred_email,
      project_description: project_type,
      source: 'referral',
      referrer_id: referrer_lead_id,
      stage: 'lead',
    }).select().single()

    const basePrompt = await callAssembleContext('agent-referral-intake', 'draft referral thank-you and outreach')
    const systemPrompt = (basePrompt ??
      buildSystemPrompt(company, 'referral coordinator'))
      + `\n\nREFERRAL INTAKE\nDraft warm thank-you to referrer and outreach to referred lead. Sound like Adam, not a corporation. No em dashes.`

    const thankYou = await callClaude(systemPrompt, `Draft a warm, personal thank-you text to ${referring_client_name} for referring ${referred_name} to ${company.name}. Under 3 sentences.`)
    const outreach = await callClaude(systemPrompt, `Draft an initial outreach text to ${referred_name} who was referred by ${referring_client_name}. Mention the referral, introduce ${company.name}, ask about their ${project_type} project. Under 4 sentences.`)

    await supabase.from('ai_actions').insert([
      {
        request_text: `Referral thank-you to ${referring_client_name}`,
        action_type: 'send_text',
        action_data: { recipient: referring_client_name, body: thankYou, kind: 'thank_you' },
        requires_approval: true,
        risk_level: 'high',
        status: 'pending',
      },
      {
        request_text: `Referral outreach to ${referred_name}`,
        action_type: 'send_text',
        action_data: { recipient: referred_name, lead_id: lead?.id, body: outreach, kind: 'referral_outreach' },
        requires_approval: true,
        risk_level: 'high',
        status: 'pending',
      },
    ])

    return new Response(JSON.stringify({ lead_id: lead?.id, thankYou, outreach }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
