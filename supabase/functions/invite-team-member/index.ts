// invite-team-member
//
// Admin adds an employee (or subcontractor-as-user) to their company. Unlike
// direct `profiles.insert(...)` from the UI (which fails — profiles.id must
// equal an auth.users.id), this function creates the auth user first, links
// the profile, then emails a magic-link invite.
//
// Input:  { email, full_name, role: 'employee' | 'admin',
//           phone?, start_date?, hourly_rate?, base_salary?, vehicle_allowance? }
// Output: { ok, profile_id, link, sent_via }
//
// Mirrors invite-client-to-portal but for internal team members — no project
// linkage, default role is 'employee'. Admin-only, rate-limited.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logUsage } from '../_shared/usage-logger.ts'

const InputSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  role: z.enum(['employee', 'admin']).default('employee'),
  phone: z.string().optional(),
  start_date: z.string().optional(),
  hourly_rate: z.number().nullable().optional(),
  base_salary: z.number().nullable().optional(),
  vehicle_allowance: z.number().nullable().optional(),
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
  if (auth.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
      status: 403,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'invite-team-member')
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Pull caller's company_id
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
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Admin has no company — complete onboarding first' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // 2. Find or create
    const normalizedEmail = input.email.trim().toLowerCase()
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, role, company_id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile && existingProfile.company_id && existingProfile.company_id !== companyId) {
      return new Response(
        JSON.stringify({ error: 'A user with that email belongs to a different company' }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    let profileId: string | null = existingProfile?.id ?? null
    if (!profileId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { full_name: input.full_name },
      })
      if (createErr || !created?.user) {
        return new Response(
          JSON.stringify({ error: 'Failed to create auth user', details: createErr?.message }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
        )
      }
      profileId = created.user.id
    }

    // 3. Upsert profile with all provided fields
    const profileRow: Record<string, unknown> = {
      id: profileId,
      email: normalizedEmail,
      role: input.role,
      full_name: input.full_name,
      company_id: companyId,
    }
    if (input.phone) profileRow.phone = input.phone
    if (input.start_date) profileRow.start_date = input.start_date
    if (input.hourly_rate !== undefined) profileRow.hourly_rate = input.hourly_rate
    if (input.base_salary !== undefined) profileRow.base_salary = input.base_salary
    if (input.vehicle_allowance !== undefined) profileRow.vehicle_allowance = input.vehicle_allowance

    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' })
    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to upsert profile', details: upsertErr.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // 4. Generate magic link
    const redirectTo = (Deno.env.get('EMPLOYEE_REDIRECT_URL') ??
      'https://akrenovationsopsapp.vercel.app/employee').trim()
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

    // 5. Send invite email (non-blocking — if email fails, we still return the link so admin can share manually)
    let sentVia: 'email' | 'manual' = 'manual'
    const subject = 'Welcome to AK Renovations'
    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <h2>Hi ${escapeHtml(input.full_name)},</h2>
        <p>You've been added to AK Renovations. Click the button to sign in and set up your account.</p>
        <p>
          <a href="${link}" style="display:inline-block; padding:12px 20px; background:#223040; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
            Sign in
          </a>
        </p>
        <p style="color:#666; font-size:13px;">This link is single-use. If it expires, ask your admin to resend.</p>
        <p style="color:#666; font-size:13px;">— AK Renovations</p>
      </div>
    `
    try {
      const authHeader = req.headers.get('Authorization') ?? `Bearer ${anonKey}`
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ to: normalizedEmail, subject, html }),
      })
      if (sendRes.ok) sentVia = 'email'
    } catch (err) {
      console.warn('send-email fetch error:', err)
    }

    logUsage({
      service: 'supabase',
      agentName: 'invite-team-member',
      units: 1,
      costUsd: 0,
      metadata: {
        profile_id: profileId,
        email: normalizedEmail,
        role: input.role,
        sent_via: sentVia,
        triggered_by: auth.user_id,
      },
    }).catch(() => {})

    return new Response(
      JSON.stringify({ ok: true, profile_id: profileId, link, sent_via: sentVia }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('invite-team-member error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
