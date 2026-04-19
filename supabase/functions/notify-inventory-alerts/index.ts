// notify-inventory-alerts (PR 18)
// ─────────────────────────────────────────────────────────────────────────────
// Daily digest email for admins when new inventory alerts have landed. Runs
// ~15 min AFTER agent-inventory-alerts so the new alerts are already in the
// table. Scheduled by 20260415001200_inventory_notification_cron.sql.
//
// Logic:
//   1. Find open alerts created in the last 24h, grouped by company.
//   2. For each company with new alerts, compose a plain-text-ish HTML digest
//      grouped by alert_type (out_of_stock / low_stock / stale_count).
//   3. Send via Resend directly (same pattern as send-email) to every admin
//      for the company.
//   4. Log via ai_usage_logs as a zero-cost record (function_name =
//      'notify-inventory-alerts') so we can see it run.
//
// No Anthropic or Gemini calls — this is a pure fan-out.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AlertType = 'low_stock' | 'out_of_stock' | 'stale_count'

interface AlertRow {
  id: string
  company_id: string
  item_id: string
  alert_type: AlertType
  current_total: number
  threshold: number | null
  summary: string
  recommendation: string | null
  created_at: string
  inventory_items: { name: string; unit: string } | null
}

interface ProfileRow {
  id: string
  company_id: string | null
  email: string | null
  full_name: string | null
  role: string | null
}

interface CompanyRow {
  id: string
  name: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sectionLabel(type: AlertType): string {
  if (type === 'out_of_stock') return 'Out of stock'
  if (type === 'low_stock') return 'Low stock'
  return 'Stale counts'
}

function formatAlertLine(a: AlertRow): string {
  const itemName = a.inventory_items?.name ?? 'Unknown item'
  const unit = a.inventory_items?.unit ?? ''
  const parts: string[] = [escapeHtml(itemName)]
  if (a.alert_type === 'low_stock' || a.alert_type === 'out_of_stock') {
    parts.push(`current: ${a.current_total}${unit ? ' ' + escapeHtml(unit) : ''}`)
    if (a.threshold !== null) {
      parts.push(`threshold: ${a.threshold}`)
    }
  }
  if (a.recommendation) {
    parts.push(escapeHtml(a.recommendation))
  }
  return parts.join(' — ')
}

function buildEmailHtml(
  companyName: string,
  alertsByType: Map<AlertType, AlertRow[]>,
  totalNew: number,
): string {
  const sections: string[] = []
  const order: AlertType[] = ['out_of_stock', 'low_stock', 'stale_count']
  for (const t of order) {
    const rows = alertsByType.get(t) ?? []
    if (rows.length === 0) continue
    const lines = rows.map(a => `<li style="margin:4px 0;">${formatAlertLine(a)}</li>`).join('')
    sections.push(`
      <h3 style="font-size:14px;margin:16px 0 4px 0;color:#0f172a;">
        ${sectionLabel(t)} (${rows.length})
      </h3>
      <ul style="padding-left:20px;margin:0;font-size:13px;color:#1f2937;">
        ${lines}
      </ul>
    `)
  }
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#0f172a;">
      <h2 style="font-size:18px;margin:0 0 4px 0;">Inventory alert digest</h2>
      <p style="font-size:13px;color:#475569;margin:0 0 12px 0;">
        ${escapeHtml(companyName)} — ${totalNew} new alert${totalNew === 1 ? '' : 's'} in the last 24 hours.
      </p>
      ${sections.join('\n')}
      <p style="font-size:11px;color:#94a3b8;margin-top:24px;">
        Sent by AK Renovations Ops. Review and resolve on the Inventory &gt; Alerts tab.
      </p>
    </div>
  `
}

function buildSubject(totalNew: number): string {
  return `Inventory alert digest — ${totalNew} item${totalNew === 1 ? '' : 's'} need${totalNew === 1 ? 's' : ''} attention`
}

async function sendEmailViaResend(
  resendApiKey: string,
  fromAddress: string,
  to: string[],
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: unknown; id?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to,
      subject,
      html,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: data }
  }
  return { ok: true, id: data?.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const startedAt = Date.now()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      // Log the miss so we notice silent failures.
      await logAiUsage({
        function_name: 'notify-inventory-alerts',
        model_provider: 'resend',
        model_name: 'resend-email',
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startedAt,
        status: 'error',
        error_message: 'RESEND_API_KEY not configured',
      })
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const fromAddress = 'AK Renovations <alerts@akrenovationsohio.com>'

    // ── 1. Pull alerts created in the last 24h that are still open ──────────
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: alertData, error: alertErr } = await supabase
      .from('inventory_alerts')
      .select(
        'id, company_id, item_id, alert_type, current_total, threshold, summary, recommendation, created_at, inventory_items(name, unit)',
      )
      .eq('status', 'open')
      .gte('created_at', since)
    if (alertErr) throw alertErr

    const alerts = (alertData ?? []) as unknown as AlertRow[]
    if (alerts.length === 0) {
      await logAiUsage({
        function_name: 'notify-inventory-alerts',
        model_provider: 'resend',
        model_name: 'resend-email',
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startedAt,
        status: 'success',
      })
      return new Response(
        JSON.stringify({ companies_notified: 0, emails_sent: 0, total_alerts: 0 }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Group alerts by company, then by type ───────────────────────────
    const byCompany = new Map<string, Map<AlertType, AlertRow[]>>()
    for (const a of alerts) {
      if (!byCompany.has(a.company_id)) byCompany.set(a.company_id, new Map())
      const typed = byCompany.get(a.company_id)!
      if (!typed.has(a.alert_type)) typed.set(a.alert_type, [])
      typed.get(a.alert_type)!.push(a)
    }

    // ── 3. Load company names + admin recipients in one pass ────────────────
    const companyIds = Array.from(byCompany.keys())
    const { data: companyData, error: companyErr } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds)
    if (companyErr) throw companyErr
    const companies = new Map<string, CompanyRow>()
    for (const c of (companyData ?? []) as CompanyRow[]) companies.set(c.id, c)

    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('id, company_id, email, full_name, role')
      .in('company_id', companyIds)
      .in('role', ['admin'])
    if (profileErr) throw profileErr
    const adminsByCompany = new Map<string, ProfileRow[]>()
    for (const p of (profileData ?? []) as ProfileRow[]) {
      if (!p.company_id || !p.email) continue
      if (!adminsByCompany.has(p.company_id)) adminsByCompany.set(p.company_id, [])
      adminsByCompany.get(p.company_id)!.push(p)
    }

    // ── 4. Send one digest per company ─────────────────────────────────────
    let emailsSent = 0
    let companiesNotified = 0
    const failures: Array<{ company_id: string; error: unknown }> = []

    for (const [companyId, typed] of byCompany.entries()) {
      const recipients = (adminsByCompany.get(companyId) ?? [])
        .map(p => p.email!)
        .filter((e): e is string => !!e)
      if (recipients.length === 0) continue

      const companyName = companies.get(companyId)?.name ?? 'Your company'
      const totalNew = Array.from(typed.values()).reduce((n, arr) => n + arr.length, 0)
      const html = buildEmailHtml(companyName, typed, totalNew)
      const subject = buildSubject(totalNew)

      const result = await sendEmailViaResend(
        resendApiKey,
        fromAddress,
        recipients,
        subject,
        html,
      )
      if (result.ok) {
        emailsSent += recipients.length
        companiesNotified += 1
      } else {
        failures.push({ company_id: companyId, error: result.error })
      }
    }

    await logAiUsage({
      function_name: 'notify-inventory-alerts',
      model_provider: 'resend',
      model_name: 'resend-email',
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: Date.now() - startedAt,
      status: failures.length > 0 ? 'error' : 'success',
      error_message: failures.length > 0 ? JSON.stringify(failures).slice(0, 500) : undefined,
    })

    return new Response(
      JSON.stringify({
        companies_notified: companiesNotified,
        emails_sent: emailsSent,
        total_alerts: alerts.length,
        failures,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('notify-inventory-alerts error:', err)
    await logAiUsage({
      function_name: 'notify-inventory-alerts',
      model_provider: 'resend',
      model_name: 'resend-email',
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: Date.now() - startedAt,
      status: 'error',
      error_message: err instanceof Error ? err.message : String(err),
    }).catch(() => {})
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
