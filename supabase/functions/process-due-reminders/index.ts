// process-due-reminders
// Cron dispatcher. Runs every minute via pg_cron (see migration
// 20260416000000_reminders.sql).
//
// Fires every pending reminder whose remind_at has passed. For each, fans out
// to the user's configured channels (respecting notification_preferences),
// inserts a notifications row (in-app bell), and — for recurring reminders —
// schedules the next instance.
//
// Idempotent on the hot path: we UPDATE status -> 'sent' before any send. If
// the update affects 0 rows (race with another dispatcher run), we skip.
//
// No auth — operates as service_role. Rate-limited by the cron schedule
// itself (once/minute).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const MAX_BATCH = 200 // ceiling per run to keep invocation bounded

interface ReminderRow {
  id: string
  user_id: string
  company_id: string
  title: string
  body: string | null
  remind_at: string
  timezone: string | null
  recurrence: 'daily' | 'weekly' | null
  channels: string[]
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  notification_preferences: {
    email?: boolean
    sms?: boolean
    in_app?: boolean
    sound?: boolean
  } | null
}

function nextInstance(remindAt: string, recurrence: 'daily' | 'weekly'): string {
  const d = new Date(remindAt)
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Pull due reminders. No locking — idempotency is enforced by the
  // conditional UPDATE further down.
  const { data: due, error: fetchErr } = await admin
    .from('reminders')
    .select('id, user_id, company_id, title, body, remind_at, timezone, recurrence, channels')
    .eq('status', 'pending')
    .lte('remind_at', new Date().toISOString())
    .order('remind_at', { ascending: true })
    .limit(MAX_BATCH)

  if (fetchErr) {
    console.error('process-due-reminders fetch error:', fetchErr)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  // Batch-load profiles for all distinct user_ids.
  const userIds = Array.from(new Set((due as ReminderRow[]).map((r) => r.user_id)))
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, notification_preferences')
    .in('id', userIds)

  const profileById = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  let sent = 0
  let partial = 0
  let errored = 0

  // Match the from-line the rest of the app uses (send-email edge function).
  // Using a different local-part ('reminders@') was rejected by Resend even
  // though the domain is the same — only specific senders are validated.
  const FROM_LINE = 'AK Renovations <akrenovations@akrenovationsohio.com>'

  for (const r of due as ReminderRow[]) {
    // Claim this row: only proceed if we flip pending -> sent. If the UPDATE
    // affects 0 rows, another dispatcher beat us to it.
    const { data: claimed, error: claimErr } = await admin
      .from('reminders')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', r.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (claimErr || !claimed) continue

    const profile = profileById.get(r.user_id)
    const prefs = profile?.notification_preferences ?? { email: true, sms: false, in_app: true, sound: true }
    const channels: string[] = Array.isArray(r.channels) ? r.channels : ['in_app', 'email']

    const errors: string[] = []
    let anyChannelSucceeded = false

    // ─── In-app ───
    if (channels.includes('in_app') && prefs.in_app !== false) {
      const { error: notifErr } = await admin.from('notifications').insert({
        user_id: r.user_id,
        company_id: r.company_id,
        kind: 'reminder',
        title: r.title,
        body: r.body,
        source_reminder_id: r.id,
      })
      if (notifErr) errors.push(`in_app: ${notifErr.message}`)
      else anyChannelSucceeded = true
    }

    // ─── Email (via Resend directly — matches notify-inventory-alerts) ───
    if (channels.includes('email') && prefs.email !== false && profile?.email && resendApiKey) {
      try {
        const html = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 12px;color:#1e3a5f;">${escapeHtml(r.title)}</h2>
            ${r.body ? `<p style="margin:0 0 16px;color:#333;white-space:pre-wrap;">${escapeHtml(r.body)}</p>` : ''}
            <p style="margin:24px 0 0;color:#888;font-size:13px;">
              Reminder scheduled in AK Renovations Ops.
            </p>
          </div>
        `
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: FROM_LINE,
            to: [profile.email],
            subject: r.title,
            html,
          }),
        })
        if (!resp.ok) {
          const t = await resp.text().catch(() => '')
          errors.push(`email: ${resp.status} ${t.slice(0, 200)}`)
        } else {
          anyChannelSucceeded = true
        }
      } catch (e) {
        errors.push(`email: ${String(e)}`)
      }
    }

    // ─── SMS intentionally deferred to a later PR ───

    // Partial-success semantics: the reminder's job is to notify the user. If
    // ANY channel succeeded, the reminder fired from the user's POV — mark it
    // 'sent'. Only mark 'error' if every attempted channel failed. Any channel
    // errors are recorded in error_message either way so operators can triage.
    if (errors.length === 0) {
      sent++
    } else if (anyChannelSucceeded) {
      partial++
      await admin
        .from('reminders')
        .update({ error_message: `Partial delivery — ${errors.join(' | ')}` })
        .eq('id', r.id)
    } else {
      errored++
      await admin
        .from('reminders')
        .update({ status: 'error', error_message: errors.join(' | ') })
        .eq('id', r.id)
    }

    // ─── Recurrence: queue the next instance ───
    if (r.recurrence === 'daily' || r.recurrence === 'weekly') {
      const next = nextInstance(r.remind_at, r.recurrence)
      await admin.from('reminders').insert({
        user_id: r.user_id,
        company_id: r.company_id,
        title: r.title,
        body: r.body,
        remind_at: next,
        timezone: r.timezone,
        recurrence: r.recurrence,
        channels: r.channels,
        status: 'pending',
      })
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: due.length, sent, partial, errored }),
    { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
  )
})
