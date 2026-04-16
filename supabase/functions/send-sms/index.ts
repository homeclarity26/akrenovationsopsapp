// send-sms — Send SMS via Twilio REST API
//
// Admin or employee only. Rate-limited at 100/hr.
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars.
//
// Input:  { to, body }
// Output: { ok, sid }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logUsage } from '../_shared/usage-logger.ts'

const InputSchema = z.object({
  to: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'E.164 format required'),
  body: z.string().min(1, 'body is required').max(1600, 'body exceeds 1600 chars'),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  // Admin or employee only
  if (!['super_admin', 'admin', 'employee'].includes(auth.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'send-sms')
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
    const { to, body } = parsed.data

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(
        JSON.stringify({ error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.' }),
        { status: 503, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Call Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const credentials = btoa(`${accountSid}:${authToken}`)

    const formData = new URLSearchParams()
    formData.set('To', to)
    formData.set('From', fromNumber)
    formData.set('Body', body)

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      console.error('Twilio API error:', twilioData)
      return new Response(
        JSON.stringify({
          error: 'Twilio send failed',
          twilio_code: twilioData.code,
          twilio_message: twilioData.message,
        }),
        { status: 502, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Track usage (non-blocking)
    logUsage({
      service: 'twilio',
      agentName: 'send-sms',
      units: 1,
      costUsd: 0.0079, // Twilio domestic SMS price
      metadata: {
        sid: twilioData.sid,
        to,
        triggered_by: auth.user_id,
      },
    }).catch(() => {})

    return new Response(
      JSON.stringify({ ok: true, sid: twilioData.sid }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-sms error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
