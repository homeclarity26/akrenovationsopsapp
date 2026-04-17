// dismiss-reminder
// Mark a pending or sent reminder as dismissed. Also marks any associated
// in-app notification as read.
//
// Input:  { reminder_id: UUID }
// Output: { ok }
//
// Auth: required. RLS on reminders enforces user_id = auth.uid() for UPDATE.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  reminder_id: z.string().uuid(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'dismiss-reminder')
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Scope by user_id so callers can only dismiss their OWN reminders.
    const { error: updErr } = await admin
      .from('reminders')
      .update({ status: 'dismissed' })
      .eq('id', parsed.data.reminder_id)
      .eq('user_id', auth.user_id)

    if (updErr) {
      console.error('dismiss-reminder update error:', updErr)
      return new Response(
        JSON.stringify({ error: 'Failed to dismiss reminder', details: updErr.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Also clear the bell notification, if one was created.
    await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('source_reminder_id', parsed.data.reminder_id)
      .eq('user_id', auth.user_id)
      .is('read_at', null)

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('dismiss-reminder error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
