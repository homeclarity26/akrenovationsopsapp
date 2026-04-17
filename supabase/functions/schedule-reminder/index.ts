// schedule-reminder
// Create a new reminder for the authenticated user.
// Called by: the Reminders UI (form submit) AND the meta-agent (natural-language
// reminder scheduling from the Agent Bar).
//
// Input: {
//   title:      string (required)
//   body?:      string
//   remind_at:  ISO 8601 UTC timestamp (required, must be in the future)
//   timezone?:  IANA tz string — stored for display + recurrence
//   recurrence? 'daily' | 'weekly' | null
//   channels?:  string[]  e.g. ['in_app','email']  defaults to ['in_app','email']
//   project_id? UUID
// }
//
// Auth: required. user_id + company_id are derived from the caller's profile;
// callers cannot schedule reminders for other users through this endpoint.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { z } from 'npm:zod@3'

const ALLOWED_CHANNELS = ['in_app', 'email', 'sms'] as const

const InputSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  remind_at: z.string().datetime({ offset: true }),
  timezone: z.string().max(80).optional(),
  recurrence: z.enum(['daily', 'weekly']).nullable().optional(),
  channels: z.array(z.enum(ALLOWED_CHANNELS)).min(1).max(3).optional(),
  project_id: z.string().uuid().optional(),
  created_by_agent: z.boolean().optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'schedule-reminder')
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

    const input = parsed.data
    const remindAt = new Date(input.remind_at)
    if (isNaN(remindAt.getTime())) {
      return new Response(JSON.stringify({ error: 'remind_at is not a valid timestamp' }), {
        status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (remindAt.getTime() < Date.now() - 60_000) {
      return new Response(JSON.stringify({ error: 'remind_at must be in the future' }), {
        status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve company_id from the caller's profile. We never trust a caller-
    // supplied company_id.
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('company_id, timezone')
      .eq('id', auth.user_id)
      .single()

    if (profileErr || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'Caller has no company_id on profile', details: profileErr?.message }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const channels = input.channels ?? ['in_app', 'email']
    const timezone = input.timezone ?? profile.timezone ?? null

    const { data: reminder, error: insertErr } = await admin
      .from('reminders')
      .insert({
        user_id: auth.user_id,
        company_id: profile.company_id,
        title: input.title,
        body: input.body ?? null,
        remind_at: remindAt.toISOString(),
        timezone,
        recurrence: input.recurrence ?? null,
        channels,
        project_id: input.project_id ?? null,
        created_by_agent: input.created_by_agent ?? false,
        status: 'pending',
      })
      .select('id, title, remind_at, timezone, channels, status, created_at')
      .single()

    if (insertErr) {
      console.error('schedule-reminder insert error:', insertErr)
      return new Response(
        JSON.stringify({ error: 'Failed to create reminder', details: insertErr.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, reminder }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('schedule-reminder error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
