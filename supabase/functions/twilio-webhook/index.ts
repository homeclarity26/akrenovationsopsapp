// twilio-webhook — Inbound SMS handler
//
// Twilio POSTs form-encoded data with From, Body, MessageSid, etc.
// 1. Validate X-Twilio-Signature HMAC to ensure authenticity.
// 2. Look up sender phone in profiles/projects by phone.
// 3. Insert into `messages` (channel='sms') if known sender, else `communication_log`.
// 4. Call `agent-sms-responder` for a draft reply (fire-and-forget, never auto-send).
// 5. Return empty TwiML <Response></Response>.
//
// No auth header — Twilio doesn't send JWT. Validated via HMAC signature.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logUsage } from '../_shared/usage-logger.ts'

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
const TWIML_HEADERS = { 'Content-Type': 'text/xml' }

/**
 * Validate Twilio webhook signature using HMAC-SHA1.
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): Promise<boolean> {
  // Sort params alphabetically and concatenate key+value
  const sortedKeys = Object.keys(params).sort()
  const data = url + sortedKeys.map((k) => k + params[k]).join('')

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))

  // Convert to base64
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return expected === signature
}

serve(async (req) => {
  // Twilio sends POST with form-encoded body
  if (req.method !== 'POST') {
    return new Response(TWIML_EMPTY, { status: 405, headers: TWIML_HEADERS })
  }

  const rl = await checkRateLimit(req, 'twilio-webhook')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    // Parse form body
    const formText = await req.text()
    const formParams: Record<string, string> = {}
    for (const pair of formText.split('&')) {
      const [key, val] = pair.split('=')
      if (key) formParams[decodeURIComponent(key)] = decodeURIComponent(val ?? '')
    }

    const from = formParams['From'] ?? ''
    const body = formParams['Body'] ?? ''
    const messageSid = formParams['MessageSid'] ?? ''

    if (!from || !body) {
      console.warn('twilio-webhook: missing From or Body')
      return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS })
    }

    // Validate X-Twilio-Signature
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const signature = req.headers.get('X-Twilio-Signature') ?? ''

    if (authToken && signature) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`
      const valid = await validateTwilioSignature(webhookUrl, formParams, signature, authToken)
      if (!valid) {
        console.warn('twilio-webhook: invalid signature')
        return new Response(TWIML_EMPTY, { status: 403, headers: TWIML_HEADERS })
      }
    } else if (authToken && !signature) {
      // Auth token is set but no signature provided — reject
      console.warn('twilio-webhook: missing X-Twilio-Signature')
      return new Response(TWIML_EMPTY, { status: 403, headers: TWIML_HEADERS })
    }
    // If no auth token configured, skip validation (dev mode)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceKey)

    // Normalize phone for lookup: strip + prefix, compare with both formats
    const normalizedPhone = from.replace(/^\+/, '')

    // Look up sender in profiles by phone
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_id')
      .or(`phone.eq.${from},phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone}`)
      .maybeSingle()

    // Try to find associated project
    let projectId: string | null = null
    if (profile) {
      // If client, find their project
      if (profile.role === 'client') {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('client_user_id', profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        projectId = project?.id ?? null
      }
    } else {
      // Look up in projects by client phone (for unregistered clients)
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .or(`client_phone.eq.${from},client_phone.eq.${normalizedPhone}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      projectId = project?.id ?? null
    }

    if (profile) {
      // Known sender — insert into messages table
      await supabase.from('messages').insert({
        project_id: projectId,
        sender_id: profile.id,
        sender_role: profile.role,
        channel: 'sms',
        message: body,
        sms_sid: messageSid || null,
        is_read: false,
        is_ai_generated: false,
      })
    } else {
      // Unknown sender — insert into communication_log
      await supabase.from('communication_log').insert({
        project_id: projectId,
        comm_type: 'sms',
        direction: 'inbound',
        channel: 'sms',
        party_name: from,
        party_type: 'other',
        summary: body.slice(0, 200),
        body,
        logged_via: 'import',
        occurred_at: new Date().toISOString(),
      })
    }

    // Fire agent-sms-responder for draft reply (non-blocking)
    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/functions/v1/agent-sms-responder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          from,
          body,
          message_sid: messageSid,
          sender_profile_id: profile?.id ?? null,
          project_id: projectId,
        }),
      }).catch((err) => console.error('agent-sms-responder fire-and-forget error:', err))
    }

    // Track usage (non-blocking)
    logUsage({
      service: 'twilio',
      agentName: 'twilio-webhook',
      units: 1,
      costUsd: 0,
      metadata: {
        from,
        message_sid: messageSid,
        known_sender: !!profile,
        project_id: projectId,
      },
    }).catch(() => {})

    return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS })
  } catch (err) {
    console.error('twilio-webhook error:', err)
    // Always return valid TwiML so Twilio doesn't retry excessively
    return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS })
  }
})
