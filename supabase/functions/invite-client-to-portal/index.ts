// invite-client-to-portal
//
// Sends a magic-link portal invite to a project's client. The admin triggers
// this from the project detail page after a project has been set up.
//
// Responsibilities:
//   1. Find or create a `profiles` row for the client (role='client', company_id
//      inherited from the calling admin).
//   2. Link the project to that profile by setting
//      projects.client_user_id = profile.id. Verify the admin has access to
//      the project via is_admin() (service-role insert trusts the admin gate).
//   3. Generate a magic-link sign-in URL for that email via the Supabase admin
//      auth API.
//   4. Deliver it:
//        - method='email' → call the existing send-email edge function
//        - method='sms'   → placeholder (returns link for manual send; Twilio
//                           wiring is a later PR)
//
// Input:  { project_id, client_email, client_full_name, method }
// Output: { ok, link, sent_via }
//
// Admin-only. Rate-limited. Usage tracked via logUsage (no AI cost).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logUsage } from '../_shared/usage-logger.ts'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
  client_email: z.string().email(),
  client_full_name: z.string().min(1).max(200),
  client_phone: z.string().optional(),
  method: z.enum(['email', 'sms']).default('email'),
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

  // Admin-only
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
      status: 403,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'invite-client-to-portal')
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
    const { project_id, client_email, client_full_name, client_phone, method } = parsed.data

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Get admin's company_id to seed the new profile
    const { data: adminProfile, error: adminErr } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', auth.user_id)
      .maybeSingle()
    if (adminErr) {
      return new Response(JSON.stringify({ error: 'Failed to load admin profile' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    const companyId = adminProfile?.company_id ?? null

    // 2. Find or create the client profile
    const normalizedEmail = client_email.trim().toLowerCase()
    const { data: existingProfile, error: lookupErr } = await admin
      .from('profiles')
      .select('id, role, company_id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (lookupErr) {
      return new Response(JSON.stringify({ error: 'Failed to look up profile' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // C4: Verify project belongs to admin's company
    const { data: project, error: projErr } = await admin
      .from('projects')
      .select('id, company_id')
      .eq('id', project_id)
      .single()
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (project.company_id !== companyId) {
      return new Response(JSON.stringify({ error: 'Project does not belong to your company' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let clientProfileId: string | null = existingProfile?.id ?? null

    // Reject if existing client profile belongs to a different company
    if (existingProfile && existingProfile.company_id && existingProfile.company_id !== companyId) {
      return new Response(
        JSON.stringify({ error: 'Client profile belongs to a different company' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    if (!clientProfileId) {
      // Create an auth user first so a real profile row is keyed to a real auth id.
      // The on_auth_user_created trigger will insert a profile row; we then update
      // that row to set role='client' + company_id + full_name.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { full_name: client_full_name },
      })
      if (createErr || !created?.user) {
        return new Response(
          JSON.stringify({ error: 'Failed to create client user', details: createErr?.message }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
        )
      }
      clientProfileId = created.user.id

      // Upsert the profile row (trigger may already have inserted a minimal row)
      const { error: upsertErr } = await admin
        .from('profiles')
        .upsert(
          {
            id: clientProfileId,
            email: normalizedEmail,
            role: 'client',
            full_name: client_full_name,
            company_id: companyId,
          },
          { onConflict: 'id' },
        )
      if (upsertErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to upsert client profile', details: upsertErr.message }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
        )
      }
    } else if (existingProfile?.role !== 'client') {
      // Don't silently change a non-client user into a client. Refuse.
      return new Response(
        JSON.stringify({
          error: `A user already exists for ${normalizedEmail} with role ${existingProfile?.role}. Cannot reassign to client.`,
        }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // 3. Link the project — admin has access via is_admin() (service role bypass anyway).
    const { error: linkErr } = await admin
      .from('projects')
      .update({ client_user_id: clientProfileId })
      .eq('id', project_id)
    if (linkErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to link project', details: linkErr.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // 4. Generate magic link
    const redirectTo = (Deno.env.get('PORTAL_REDIRECT_URL') ??
      'https://akrenovationsopsapp.vercel.app/client').trim()
    const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo },
    })
    if (linkGenErr || !linkData?.properties?.action_link) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate magic link', details: linkGenErr?.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const link = linkData.properties.action_link

    // 5. Deliver
    let sentVia: 'email' | 'sms' | 'manual' = 'manual'

    if (method === 'email') {
      const subject = 'Your AK Renovations project portal'
      const html = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #1a1a1a;">Hi ${escapeHtml(client_full_name)},</h2>
          <p>Your project portal is ready. You can track progress, view invoices, message your contractor, and see photos of the work in one place.</p>
          <p>
            <a href="${link}" style="display:inline-block; padding:12px 20px; background:#223040; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
              Open your portal
            </a>
          </p>
          <p style="color:#666; font-size:13px;">This sign-in link is single-use. If it expires, reach out and we'll send a new one.</p>
          <p style="color:#666; font-size:13px;">— AK Renovations</p>
        </div>
      `
      try {
        const authHeader = req.headers.get('Authorization') ?? `Bearer ${anonKey}`
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward the admin's auth so send-email rate-limits + logs to them.
            'Authorization': authHeader,
          },
          body: JSON.stringify({ to: normalizedEmail, subject, html }),
        })
        if (sendRes.ok) {
          sentVia = 'email'
        } else {
          const errBody = await sendRes.text().catch(() => '')
          console.warn('send-email failed:', sendRes.status, errBody)
          sentVia = 'manual'
        }
      } catch (err) {
        console.warn('send-email fetch error:', err)
        sentVia = 'manual'
      }
    } else if (method === 'sms') {
      // Wire to Twilio send-sms if configured, otherwise fall back to manual
      const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''
      if (twilioPhone && client_phone) {
        try {
          const smsBody = `Hi ${client_full_name}, your AK Renovations project portal is ready. Open it here: ${link}`
          const authHeader = req.headers.get('Authorization') ?? `Bearer ${anonKey}`
          const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({ to: client_phone, body: smsBody }),
          })
          if (smsRes.ok) {
            sentVia = 'sms'
          } else {
            const errBody = await smsRes.text().catch(() => '')
            console.warn('send-sms failed:', smsRes.status, errBody)
            sentVia = 'manual'
          }
        } catch (err) {
          console.warn('send-sms fetch error:', err)
          sentVia = 'manual'
        }
      } else {
        // Twilio not configured — fall back to manual
        sentVia = 'manual'
      }
    }

    // Track usage (non-blocking)
    logUsage({
      service: 'supabase',
      agentName: 'invite-client-to-portal',
      units: 1,
      costUsd: 0,
      metadata: {
        project_id,
        client_email: normalizedEmail,
        client_profile_id: clientProfileId,
        method,
        sent_via: sentVia,
        triggered_by: auth.user_id,
      },
    }).catch(() => {})

    return new Response(
      JSON.stringify({ ok: true, link, sent_via: sentVia }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('invite-client-to-portal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
