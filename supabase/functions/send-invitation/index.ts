// send-invitation — PR #19
// Creates an invitation record and sends the appropriate welcome email via Resend.
// Handles both employee invitations (admin-created with temp password) and
// client invitations (per-project portal access).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { z } from 'npm:zod@3'

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const resendKey   = () => Deno.env.get('RESEND_API_KEY') ?? ''
const appUrl      = () => Deno.env.get('APP_URL') ?? 'https://akrenovationsopsapp.vercel.app'

const EmployeeSchema = z.object({
  type: z.literal('employee'),
  email: z.string().email(),
  full_name: z.string(),
  role_title: z.enum(['employee', 'admin']).default('employee'),
  pay_type: z.enum(['hourly', 'salary']).optional(),
  pay_rate: z.number().optional(),
  start_date: z.string().optional(),
  emergency_contact: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

const ClientSchema = z.object({
  type: z.literal('client'),
  email: z.string().email(),
  full_name: z.string(),
  project_id: z.string().uuid(),
  project_name: z.string(),
})

const InputSchema = z.discriminatedUnion('type', [EmployeeSchema, ClientSchema])

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TradeOffice AI <noreply@mail.tradeofficeai.com>',
      to: [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(supabaseUrl(), serviceKey())
    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Get the inviting user's company
    const { data: inviter } = await supabase
      .from('profiles')
      .select('company_id, full_name')
      .eq('id', auth.sub)
      .single()

    if (!inviter?.company_id) {
      return new Response(
        JSON.stringify({ error: 'No company found for this user' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', inviter.company_id)
      .single()

    const companyName = company?.name ?? 'Your Company'
    const input = parsed.data

    if (input.type === 'employee') {
      const tempPassword = generateTempPassword()

      // Create auth user
      const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
        email: input.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: input.full_name },
      })
      if (userErr) throw new Error(`Failed to create user: ${userErr.message}`)

      // Update profile with company + role + employee fields
      await supabase.from('profiles').upsert({
        id: newUser.user!.id,
        email: input.email,
        full_name: input.full_name,
        role: input.role_title,
        company_id: inviter.company_id,
        phone: input.phone ?? null,
        pay_type: input.pay_type ?? null,
        pay_rate: input.pay_rate ?? null,
        start_date: input.start_date ?? null,
        emergency_contact: input.emergency_contact ?? null,
        must_change_password: true,
        onboarding_complete: false,
      })

      // Save invitation record
      const { data: invite } = await supabase.from('invitations').insert({
        company_id: inviter.company_id,
        invited_by: auth.sub,
        email: input.email,
        role: 'employee',
        full_name: input.full_name,
        temp_password: tempPassword,
        pay_type: input.pay_type,
        pay_rate: input.pay_rate,
        start_date: input.start_date,
        emergency_contact: input.emergency_contact,
        phone: input.phone,
        notes: input.notes,
        status: 'accepted', // Already created the account
      }).select('id').single()

      // Send welcome email
      const loginUrl = `${appUrl()}/login`
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f4f0;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1B2B4D;padding:32px;text-align:center;">
      <div style="width:40px;height:40px;background:#C0392B;border-radius:10px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-weight:700;font-size:16px;">T</span>
      </div>
      <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">TradeOffice AI</p>
    </div>
    <div style="padding:32px;">
      <h1 style="color:#1B2B4D;font-size:24px;margin:0 0 8px;">Welcome to ${companyName}</h1>
      <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Your account has been created on TradeOffice AI. Here's everything you need to get started.</p>

      <div style="background:#f5f4f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.08em;">Your login credentials</p>
        <p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong>Email:</strong> ${input.email}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong>Temporary password:</strong> <code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-family:monospace;">${tempPassword}</code></p>
        <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;">You'll be asked to change your password on first login.</p>
      </div>

      <a href="${loginUrl}" style="display:block;background:#1B2B4D;color:#fff;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">Sign In to TradeOffice AI →</a>

      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 12px;">📱 Save to your phone — access your dashboard anytime</p>
        <p style="color:#6b7280;font-size:13px;font-weight:600;margin:0 0 8px;">iPhone (Safari):</p>
        <ol style="color:#6b7280;font-size:13px;margin:0 0 12px;padding-left:20px;">
          <li style="margin-bottom:4px;">Open the link above in Safari</li>
          <li style="margin-bottom:4px;">Tap the Share button at the bottom of your screen</li>
          <li style="margin-bottom:4px;">Tap "Add to Home Screen"</li>
          <li>Tap "Add" in the top right</li>
        </ol>
        <p style="color:#6b7280;font-size:13px;font-weight:600;margin:0 0 8px;">Android (Chrome):</p>
        <ol style="color:#6b7280;font-size:13px;margin:0;padding-left:20px;">
          <li style="margin-bottom:4px;">Open the link above in Chrome</li>
          <li style="margin-bottom:4px;">Tap the three dots in the top right</li>
          <li style="margin-bottom:4px;">Tap "Add to Home Screen"</li>
          <li>Tap "Add"</li>
        </ol>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">This account was created by ${inviter.full_name} at ${companyName}.</p>
    </div>
  </div>
</body>
</html>`

      await sendEmail(input.email, `You've been added to ${companyName} on TradeOffice AI`, html)

      return new Response(
        JSON.stringify({ success: true, invitation_id: invite?.id }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )

    } else {
      // Client invitation — generate token-based link
      const { data: invite } = await supabase.from('invitations').insert({
        company_id: inviter.company_id,
        invited_by: auth.sub,
        email: input.email,
        role: 'client',
        full_name: input.full_name,
        project_id: input.project_id,
        status: 'pending',
      }).select('id, token').single()

      if (!invite) throw new Error('Failed to create invitation')

      const acceptUrl = `${appUrl()}/invite/${invite.token}`
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f4f0;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1B2B4D;padding:32px;text-align:center;">
      <div style="width:40px;height:40px;background:#C0392B;border-radius:10px;margin:0 auto 12px;">
        <span style="color:#fff;font-weight:700;font-size:16px;line-height:40px;display:block;">T</span>
      </div>
      <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">TradeOffice AI</p>
    </div>
    <div style="padding:32px;">
      <h1 style="color:#1B2B4D;font-size:24px;margin:0 0 8px;">Your project portal is ready</h1>
      <p style="color:#6b7280;font-size:15px;margin:0 0 8px;">${companyName} has shared your <strong>${input.project_name}</strong> project portal with you.</p>
      <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">You'll be able to track progress, view photos, see invoices, and communicate with your contractor — all in one place.</p>

      <a href="${acceptUrl}" style="display:block;background:#1B2B4D;color:#fff;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px;">Access Your Project Portal →</a>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0 0 8px;">This link expires in 7 days.</p>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Invited by ${inviter.full_name} at ${companyName}.</p>
    </div>
  </div>
</body>
</html>`

      await sendEmail(input.email, `${companyName} has shared your project portal with you`, html)

      return new Response(
        JSON.stringify({ success: true, invitation_id: invite.id, token: invite.token }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

  } catch (err) {
    console.error('send-invitation error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
