// send-email — Final Build
// Sends transactional emails via the Resend API.
// Accepts: { to, subject, html, from_name?, from_email?, reply_to? }
// Logs all sends to api_usage_log for tracking.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logUsage } from '../_shared/usage-logger.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
  from_name: z.string().optional(),
  from_email: z.string().email().optional(),
  reply_to: z.string().email().optional(),
})

const DEFAULT_FROM_NAME = 'AK Renovations'
const DEFAULT_FROM_DOMAIN = 'akrenovationsohio.com'
const DEFAULT_FROM_LOCALPART = 'mail'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'send-email')
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

    const { to, subject, html, from_name, from_email, reply_to } = parsedInput.data

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Domain is verified at akrenovationsohio.com as of 2026-04-18, so any
    // local-part on that domain works. Default to `mail@` for generic sends;
    // callers can pass from_email to route specific purposes (e.g.
    // reminders@, alerts@, adam@) without needing code changes here.
    const fromName = from_name ?? DEFAULT_FROM_NAME
    const fromEmail = from_email ?? `${DEFAULT_FROM_LOCALPART}@${DEFAULT_FROM_DOMAIN}`

    const resendPayload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }
    if (reply_to) {
      resendPayload.reply_to = reply_to
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend API error:', resendData)
      // Log failure
      logUsage({
        service: 'resend',
        agentName: 'send-email',
        units: 1,
        costUsd: 0,
        metadata: { to, subject, error: resendData },
      }).catch(() => {})

      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: resendData }),
        { status: 502, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Log success (fire and forget)
    logUsage({
      service: 'resend',
      agentName: 'send-email',
      units: 1,
      costUsd: 0,
      metadata: {
        to,
        subject,
        resend_id: resendData.id,
        triggered_by: auth.user_id,
      },
    }).catch(() => {})

    return new Response(
      JSON.stringify({
        success: true,
        email_id: resendData.id,
        to: Array.isArray(to) ? to : [to],
        subject,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
