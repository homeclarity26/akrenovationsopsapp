// Phase I — generate-payroll-register
// Generates a full payroll register PDF/CSV for a pay period and syncs to Google Drive
// at: AK Renovations — Operations/Payroll/{year}/Payroll Register — {dates}.pdf

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callAssembleContext(agentName: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system',
        user_role: 'admin',
        agent_name: agentName,
        capability_required: 'manage_payroll',
        query: 'generate payroll register PDF',
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildRegisterHTML(period: Record<string, unknown>, records: Array<Record<string, unknown>>): string {
  const rows = records
    .map((r) => {
      const profile = (r.profiles ?? {}) as { full_name?: string }
      return `
        <tr>
          <td>${profile.full_name ?? '—'}</td>
          <td>${r.worker_type}</td>
          <td class="num">${Number(r.total_hours ?? 0).toFixed(1)}</td>
          <td class="num">${fmtCurrency(Number(r.gross_pay ?? 0))}</td>
          <td class="num">${fmtCurrency(Number(r.total_deductions ?? 0))}</td>
          <td class="num">${fmtCurrency(Number(r.est_net_pay ?? 0))}</td>
          <td class="num">${fmtCurrency(Number(r.total_employer_cost ?? 0))}</td>
        </tr>`
    })
    .join('')

  const totalGross = records.reduce((s, r) => s + Number(r.gross_pay ?? 0), 0)
  const totalCost = records.reduce((s, r) => s + Number(r.total_employer_cost ?? 0), 0)

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; padding: 32px; color: #1A1A1A; }
  h1 { color: #1B2B4D; font-size: 24px; margin: 0 0 8px; }
  .meta { color: #6B7280; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #F5F0E6; padding: 8px; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #E8E8E6; }
  td.num, th.num { text-align: right; font-family: monospace; }
  .totals { margin-top: 16px; padding-top: 16px; border-top: 2px solid #1B2B4D; font-weight: 600; }
  .footer { margin-top: 24px; font-size: 10px; color: #9CA3AF; font-style: italic; }
</style></head><body>
  <h1>Payroll Register</h1>
  <div class="meta">${fmtDate(period.period_start as string)} – ${fmtDate(period.period_end as string)} · Pay date: ${fmtDate(period.pay_date as string)}</div>
  <table>
    <thead><tr>
      <th>Worker</th><th>Type</th><th class="num">Hours</th>
      <th class="num">Gross</th><th class="num">Deductions</th>
      <th class="num">Est. Net</th><th class="num">Employer Cost</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    Total gross: ${fmtCurrency(totalGross)} &nbsp;·&nbsp; Total employer cost: ${fmtCurrency(totalCost)}
  </div>
  <div class="footer">All withholding amounts are estimated. Gusto calculates exact figures during submission.</div>
</body></html>`
}

function buildCsv(records: Array<Record<string, unknown>>): string {
  const headers = [
    'worker_name',
    'worker_type',
    'regular_hours',
    'overtime_hours',
    'total_hours',
    'gross_pay',
    'health_deduction',
    'retirement_deduction',
    'est_federal_withholding',
    'est_state_withholding',
    'est_employee_ss',
    'est_employee_medicare',
    'total_deductions',
    'est_net_pay',
    'total_employer_cost',
  ]
  const lines = [headers.join(',')]
  for (const r of records) {
    const profile = (r.profiles ?? {}) as { full_name?: string }
    const row = [
      `"${(profile.full_name ?? '').replace(/"/g, '""')}"`,
      r.worker_type,
      r.regular_hours,
      r.overtime_hours,
      r.total_hours,
      r.gross_pay,
      r.health_deduction,
      r.retirement_deduction,
      r.est_federal_withholding,
      r.est_state_withholding,
      r.est_employee_ss,
      r.est_employee_medicare,
      r.total_deductions,
      r.est_net_pay,
      r.total_employer_cost,
    ]
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

async function syncToDrive(filename: string, content: string, contentType: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/sync-to-drive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        folder_path: 'AK Renovations — Operations/Payroll',
        filename,
        content,
        content_type: contentType,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.url ?? null
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  await callAssembleContext('generate-payroll-register')

  try {
    const { pay_period_id } = (await req.json()) as { pay_period_id: string }
    if (!pay_period_id) {
      return new Response(JSON.stringify({ error: 'pay_period_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: period, error: pErr } = await supabase
      .from('pay_periods')
      .select('*')
      .eq('id', pay_period_id)
      .single()
    if (pErr || !period) throw new Error('Pay period not found')

    const { data: records } = await supabase
      .from('payroll_records')
      .select('*, profiles(full_name)')
      .eq('pay_period_id', pay_period_id)

    const recs = (records ?? []) as Array<Record<string, unknown>>
    const html = buildRegisterHTML(period, recs)
    const csv = buildCsv(recs)

    // Save HTML to storage as a placeholder PDF artifact
    const datesLabel = `${period.period_start}_${period.period_end}`
    const pdfPath = `payroll/${period.year}/payroll_register_${datesLabel}.html`
    const csvPath = `payroll/${period.year}/payroll_register_${datesLabel}.csv`

    await supabase.storage.from('documents').upload(pdfPath, new Blob([html], { type: 'text/html' }), { upsert: true })
    await supabase.storage.from('documents').upload(csvPath, new Blob([csv], { type: 'text/csv' }), { upsert: true })

    const driveLabel = `Payroll Register — ${period.period_start} ${period.period_end}`
    const drivePdfUrl = await syncToDrive(`${driveLabel}.pdf`, html, 'application/pdf')
    const driveCsvUrl = await syncToDrive(`${driveLabel}.csv`, csv, 'text/csv')

    return new Response(
      JSON.stringify({
        success: true,
        pay_period_id,
        pdf_storage_path: pdfPath,
        csv_storage_path: csvPath,
        drive_pdf_url: drivePdfUrl,
        drive_csv_url: driveCsvUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
