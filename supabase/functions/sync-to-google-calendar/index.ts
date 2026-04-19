// sync-to-google-calendar — bidirectional sync for schedule_events.
//
// On admin action "sync with Google", this function reads a schedule_events
// row, creates (or patches) the corresponding Google Calendar event on a
// shared calendar, and writes back google_calendar_event_id on the row.
// Uses the same service account JSON that already backs sync-to-drive, plus
// a new secret GOOGLE_CALENDAR_ID (the shared calendar the service account
// has write access to).
//
// Setup requirement Adam must do once:
//   1. In Google Calendar, share the target calendar with the service
//      account email (from GOOGLE_SERVICE_ACCOUNT_JSON.client_email) with
//      "Make changes to events" permission.
//   2. Copy the calendar's Calendar ID and add it as Supabase secret
//      GOOGLE_CALENDAR_ID.
// Until those two are set, the function returns 501 with a clear message.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  event_id: z.string().uuid('event_id must be a valid UUID'),
  action: z.enum(['upsert', 'delete']).default('upsert'),
})

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Google Drive and Calendar share the same service-account JWT flow — just
// different scope. Reusing the exact dance from sync-to-drive.
async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')

  const serviceAccount = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const headerB64  = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${headerB64}.${payloadB64}`

  const privateKeyPem = serviceAccount.private_key as string
  const pemContent = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----\n?/, '').replace(/\n?-----END PRIVATE KEY-----\n?/, '').replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Failed to get Calendar token: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token as string
}

// Turn a schedule_events row into the Google Calendar event body shape.
function buildEventBody(row: Record<string, unknown>): Record<string, unknown> {
  const project = row.projects as Record<string, unknown> | null
  const title = String(row.title ?? 'Untitled')
  const description = [
    row.description ? String(row.description) : null,
    project?.title ? `Project: ${String(project.title)}` : null,
  ].filter(Boolean).join('\n\n')
  const location = String(row.location ?? project?.address ?? '') || undefined

  const startDate = String(row.start_date)
  const endDate = String(row.end_date ?? row.start_date)

  const allDay = !!row.all_day
  const summary = title
  if (allDay) {
    // GCal all-day end date is EXCLUSIVE, add 1 day.
    const end = new Date(`${endDate}T00:00:00`)
    end.setDate(end.getDate() + 1)
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    return {
      summary,
      description,
      location,
      start: { date: startDate },
      end: { date: endStr },
    }
  }

  const startTime = (row.start_time as string | null) ?? '09:00:00'
  const endTime   = (row.end_time   as string | null) ?? '10:00:00'
  const tz = Deno.env.get('GOOGLE_CALENDAR_TIMEZONE') || 'America/New_York'
  return {
    summary,
    description,
    location,
    start: { dateTime: `${startDate}T${startTime}`, timeZone: tz },
    end:   { dateTime: `${endDate}T${endTime}`,     timeZone: tz },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'sync-to-google-calendar')
  if (!rl.allowed) return rateLimitResponse(rl)

  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')
  if (!calendarId) {
    return new Response(
      JSON.stringify({
        error: 'GOOGLE_CALENDAR_ID not configured',
        setup: 'Share the target Google Calendar with the service account email and set GOOGLE_CALENDAR_ID in Supabase secrets.',
      }),
      { status: 501, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }

  try {
    const supabase = createClient(supabaseUrl(), serviceKey())
    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }
    const { event_id, action } = parsed.data

    const { data: event, error: evErr } = await supabase
      .from('schedule_events')
      .select('*, projects(title, address)')
      .eq('id', event_id)
      .single()
    if (evErr || !event) throw evErr ?? new Error('Event not found')

    const accessToken = await getAccessToken()
    const existingGCalId = event.google_calendar_event_id as string | null

    if (action === 'delete') {
      if (!existingGCalId) {
        return new Response(JSON.stringify({ ok: true, message: 'No GCal event to delete' }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
      }
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingGCalId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!res.ok && res.status !== 410) {
        const txt = await res.text()
        throw new Error(`GCal delete failed (${res.status}): ${txt}`)
      }
      await supabase.from('schedule_events').update({ google_calendar_event_id: null }).eq('id', event_id)
      return new Response(JSON.stringify({ ok: true, deleted: true }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Upsert
    const eventBody = buildEventBody(event as Record<string, unknown>)
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    const res = existingGCalId
      ? await fetch(`${baseUrl}/${existingGCalId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        })
      : await fetch(baseUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`GCal ${existingGCalId ? 'patch' : 'insert'} failed (${res.status}): ${txt}`)
    }
    const gcal = await res.json()
    const newId = gcal.id as string

    if (!existingGCalId) {
      await supabase.from('schedule_events').update({ google_calendar_event_id: newId }).eq('id', event_id)
    }

    return new Response(
      JSON.stringify({ ok: true, google_calendar_event_id: newId, htmlLink: gcal.htmlLink }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
