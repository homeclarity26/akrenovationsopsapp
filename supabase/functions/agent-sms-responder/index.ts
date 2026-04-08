import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

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

type Intent = 'scheduling' | 'payment' | 'update' | 'new_inquiry' | 'unknown'

function classifyIntent(message: string): Intent {
  const lower = message.toLowerCase()
  if (/schedul|appointment|when|what time|available|book|meet/i.test(lower)) return 'scheduling'
  if (/pay|invoice|bill|owe|check|venmo|zelle|card/i.test(lower)) return 'payment'
  if (/progress|update|status|how.*(going|coming)|done yet|finish/i.test(lower)) return 'update'
  if (/interest|quote|estimate|remodel|renovate|project|kitchen|bath|basement|addition/i.test(lower)) return 'new_inquiry'
  return 'unknown'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-sms-responder')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Support both Twilio webhook format and direct JSON
    let fromPhone = ''
    let messageBody = ''
    let messageSid = ''

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      const params = new URLSearchParams(text)
      fromPhone = params.get('From') ?? ''
      messageBody = params.get('Body') ?? ''
      messageSid = params.get('MessageSid') ?? ''
    } else {
      const body = await req.json().catch(() => ({}))
      fromPhone = body.From ?? body.from_phone ?? ''
      messageBody = body.Body ?? body.message ?? ''
      messageSid = body.MessageSid ?? body.message_sid ?? ''
    }

    if (!fromPhone || !messageBody) {
      return new Response(JSON.stringify({ error: 'From phone and Body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const basePrompt = await callAssembleContext('agent-sms-responder', 'classify and respond to inbound SMS')

    // Normalize phone number
    const normalizedPhone = fromPhone.replace(/\D/g, '').slice(-10)

    // Look up sender in leads and profiles
    const [{ data: matchingLeads }, { data: matchingProfiles }] = await Promise.all([
      supabase
        .from('leads')
        .select('id,full_name,stage,project_type,email')
        .ilike('phone', `%${normalizedPhone}%`)
        .limit(1),
      supabase
        .from('profiles')
        .select('id,full_name,role')
        .ilike('phone', `%${normalizedPhone}%`)
        .limit(1),
    ])

    const senderLead = matchingLeads?.[0] ?? null
    const senderProfile = matchingProfiles?.[0] ?? null
    const senderName = senderLead?.full_name ?? senderProfile?.full_name ?? 'Unknown Sender'
    const senderRole = senderProfile?.role ?? (senderLead ? 'lead' : 'unknown')

    // Classify intent
    const intent = classifyIntent(messageBody)

    // Get active project if client
    let activeProject: { id: string; title: string; percent_complete: number; current_phase: string } | null = null
    if (senderLead?.id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id,title,percent_complete,current_phase')
        .eq('lead_id', senderLead.id)
        .eq('status', 'active')
        .single()
      activeProject = proj
    }

    // Log to communication_log
    await supabase.from('communication_log').insert({
      lead_id: senderLead?.id ?? null,
      client_user_id: senderProfile?.id ?? null,
      comm_type: 'sms',
      direction: 'inbound',
      summary: `Inbound SMS from ${senderName}: "${messageBody.substring(0, 100)}"`,
      transcript: messageBody,
    })

    const systemPrompt =
      (basePrompt ?? 'You are an AI assistant for AK Renovations, texting on behalf of Adam Kilgore.') +
      `

SMS RESPONSE TASK
Write a short, friendly SMS response as Adam Kilgore.
Keep it under 160 characters if possible. Conversational and helpful.
If it is a routine status question and you have data, answer it directly.
If it requires judgment or action, acknowledge receipt and say Adam will be in touch shortly.
No em dashes. SMS-appropriate length.`

    let autoRespond = false
    let responseMessage = ''

    if (intent === 'update' && activeProject) {
      // Auto-respond with project status
      autoRespond = true
      responseMessage = await callClaude(
        systemPrompt,
        `Sender: ${senderName}
Message: "${messageBody}"
Intent: project status update request
Project: ${activeProject.title}
Current phase: ${activeProject.current_phase ?? 'active construction'}
Percent complete: ${activeProject.percent_complete}%

Write the SMS response.`,
        150,
      )
    } else if (intent === 'scheduling') {
      autoRespond = false
      responseMessage = await callClaude(
        systemPrompt,
        `Sender: ${senderName}
Message: "${messageBody}"
Intent: scheduling request
Known context: ${senderLead ? `Lead in ${senderLead.stage} stage` : senderRole}

Draft an SMS acknowledging their scheduling request and saying Adam will follow up to confirm timing.`,
        150,
      )
    } else {
      autoRespond = false
      responseMessage = await callClaude(
        systemPrompt,
        `Sender: ${senderName}
Message: "${messageBody}"
Intent: ${intent}
Sender role: ${senderRole}

Draft an SMS response — acknowledge receipt and indicate Adam will be in touch.`,
        150,
      )
    }

    if (autoRespond) {
      // For now, log as pending auto-response — in production this would trigger Twilio send
      await supabase.from('communication_log').insert({
        lead_id: senderLead?.id ?? null,
        client_user_id: senderProfile?.id ?? null,
        comm_type: 'sms',
        direction: 'outbound',
        summary: `AI auto-response to ${senderName}`,
        transcript: responseMessage,
      })
    } else {
      // Requires Adam's review
      await supabase.from('ai_actions').insert({
        request_text: `Draft SMS response to ${senderName}: "${messageBody.substring(0, 80)}"`,
        action_type: 'send_sms',
        action_data: {
          to_phone: fromPhone,
          sender_name: senderName,
          lead_id: senderLead?.id ?? null,
          original_message: messageBody,
          draft_response: responseMessage,
          intent,
          message_sid: messageSid,
        },
        requires_approval: true,
        risk_level: 'medium',
        status: 'pending',
      })
    }

    // Return TwiML for Twilio webhook (empty — we send separately)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      },
    )
  } catch (err) {
    console.error('agent-sms-responder error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
