// sync-to-gusto — Push employees + pay periods to Gusto, pull payroll results.
// Uses OAuth tokens via gusto-auth/getGustoToken (auto-refreshes).
//
// Actions:
//   { action: 'push_employees' }              — create missing employees in Gusto
//   { pay_period_id, dry_run? }               — push approved payroll records
//   { action: 'pull_results', pay_period_id } — pull processed payroll back

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { getGustoToken } from '../gusto-auth/index.ts'

const InputSchema = z.object({
  action: z.enum(['push_employees', 'push_payroll', 'pull_results']).optional(),
  pay_period_id: z.string().uuid().optional(),
  dry_run: z.boolean().optional(),
  company_id: z.string().uuid().optional(),
}).refine(
  (d) => d.action === 'push_employees' || d.pay_period_id,
  { message: 'pay_period_id required for payroll actions' },
)

function gustoApi() {
  return Deno.env.get('GUSTO_ENVIRONMENT') === 'sandbox'
    ? 'https://api.gusto-demo.com/v1'
    : 'https://api.gusto.com/v1'
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

function gustoHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Push employees — create in Gusto for profiles without gusto_employee_id
// ---------------------------------------------------------------------------

async function pushEmployees(token: string, companyUuid: string) {
  const db = supabaseAdmin()
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['employee', 'admin'])
    .is('gusto_employee_id', null)

  if (!profiles || profiles.length === 0) {
    return { employees_synced: 0, errors: [], message: 'All employees already synced' }
  }

  const results: Array<{ profile_id: string; ok: boolean; gusto_id?: string; error?: string }> = []

  for (const p of profiles) {
    try {
      const nameParts = (p.full_name ?? '').split(' ')
      const firstName = nameParts[0] ?? ''
      const lastName = nameParts.slice(1).join(' ') || firstName

      const res = await fetch(`${gustoApi()}/companies/${companyUuid}/employees`, {
        method: 'POST',
        headers: gustoHeaders(token),
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: p.email,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        results.push({ profile_id: p.id, ok: false, error: `${res.status}: ${text}` })
        continue
      }

      const gustoEmp = await res.json()
      const gustoId = (gustoEmp as { uuid?: string }).uuid ?? ''

      await db
        .from('profiles')
        .update({ gusto_employee_id: gustoId })
        .eq('id', p.id)

      results.push({ profile_id: p.id, ok: true, gusto_id: gustoId })
    } catch (e) {
      results.push({ profile_id: p.id, ok: false, error: (e as Error).message })
    }
  }

  return {
    employees_synced: results.filter((r) => r.ok).length,
    errors: results.filter((r) => !r.ok),
    results,
  }
}

// ---------------------------------------------------------------------------
// Push payroll — send approved records to Gusto
// ---------------------------------------------------------------------------

type PayrollRecord = {
  id: string
  pay_period_id: string
  profile_id: string
  worker_type: string
  total_hours: number
  overtime_hours: number
  pto_hours: number
  holiday_hours: number
  vehicle_allowance: number
  phone_stipend: number
  other_allowances: number
  bonus_amount: number
  health_deduction: number
  retirement_deduction: number
  contractor_payment: number
  status: string
  profiles?: {
    gusto_employee_id: string | null
    gusto_contractor_id: string | null
    full_name: string
  }
}

function buildFixedCompensations(rec: PayrollRecord) {
  const fixed: Array<{ name: string; amount: number }> = []
  if (rec.vehicle_allowance > 0) fixed.push({ name: 'Vehicle Allowance', amount: rec.vehicle_allowance })
  if (rec.phone_stipend > 0) fixed.push({ name: 'Phone Stipend', amount: rec.phone_stipend })
  if (rec.other_allowances > 0) fixed.push({ name: 'Other Allowance', amount: rec.other_allowances })
  if (rec.bonus_amount > 0) fixed.push({ name: 'Bonus', amount: rec.bonus_amount })
  return fixed
}

function buildHourlyCompensations(rec: PayrollRecord) {
  return [
    { name: 'Regular Hours', hours: rec.total_hours - rec.overtime_hours },
    { name: 'Overtime', hours: rec.overtime_hours },
  ]
}

function buildPTOEntries(rec: PayrollRecord) {
  const pto: Array<{ name: string; hours: number }> = []
  if (rec.pto_hours > 0) pto.push({ name: 'PTO', hours: rec.pto_hours })
  if (rec.holiday_hours > 0) pto.push({ name: 'Holiday', hours: rec.holiday_hours })
  return pto
}

async function pushPayroll(
  token: string,
  companyUuid: string,
  payPeriodId: string,
  dryRun: boolean,
) {
  const db = supabaseAdmin()

  const { data: period, error: periodErr } = await db
    .from('pay_periods')
    .select('*')
    .eq('id', payPeriodId)
    .single()
  if (periodErr || !period) throw new Error('Pay period not found')

  const { data: records } = await db
    .from('payroll_records')
    .select('*, profiles(full_name, gusto_employee_id, gusto_contractor_id)')
    .eq('pay_period_id', payPeriodId)
    .eq('status', 'approved')

  const recs = (records ?? []) as PayrollRecord[]
  if (recs.length === 0) {
    return { error: 'No approved records to sync', payroll_synced: 0 }
  }

  if (dryRun) {
    return {
      dry_run: true,
      would_sync: recs.length,
      records: recs.map((r) => r.profiles?.full_name),
    }
  }

  // Create/get Gusto payroll
  const payrollRes = await fetch(`${gustoApi()}/companies/${companyUuid}/payrolls`, {
    method: 'POST',
    headers: gustoHeaders(token),
    body: JSON.stringify({
      start_date: period.period_start,
      end_date: period.period_end,
      check_date: period.pay_date,
      off_cycle: false,
    }),
  })
  if (!payrollRes.ok) {
    const text = await payrollRes.text()
    throw new Error(`Gusto createPayroll failed: ${payrollRes.status} ${text}`)
  }
  const gustoPayroll = await payrollRes.json()
  const gustoPayrollId = (gustoPayroll as { uuid?: string }).uuid ?? ''

  const results: Array<{ profile_id: string; ok: boolean; error?: string }> = []

  for (const rec of recs) {
    try {
      if (rec.worker_type === 'contractor_1099') {
        const contractorId = rec.profiles?.gusto_contractor_id
        if (!contractorId) {
          results.push({ profile_id: rec.profile_id, ok: false, error: 'No gusto_contractor_id' })
          continue
        }
        const res = await fetch(`${gustoApi()}/contractors/${contractorId}/contractor_payments`, {
          method: 'POST',
          headers: gustoHeaders(token),
          body: JSON.stringify({
            wage: rec.contractor_payment,
            reimbursement: 0,
            bonus: 0,
            hours: 0,
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          results.push({ profile_id: rec.profile_id, ok: false, error: `${res.status}: ${text}` })
          continue
        }
      } else {
        const empId = rec.profiles?.gusto_employee_id
        if (!empId) {
          results.push({ profile_id: rec.profile_id, ok: false, error: 'No gusto_employee_id' })
          continue
        }
        const res = await fetch(
          `${gustoApi()}/payrolls/${gustoPayrollId}/employees/${empId}/compensations`,
          {
            method: 'PUT',
            headers: gustoHeaders(token),
            body: JSON.stringify({
              hours: rec.total_hours,
              flsa_overtime_hours: rec.overtime_hours,
              payment_method: 'Direct Deposit',
              fixed_compensations: buildFixedCompensations(rec),
              hourly_compensations: buildHourlyCompensations(rec),
              paid_time_off: buildPTOEntries(rec),
            }),
          },
        )
        if (!res.ok) {
          const text = await res.text()
          results.push({ profile_id: rec.profile_id, ok: false, error: `${res.status}: ${text}` })
          continue
        }
      }

      // Mark record as submitted
      await db
        .from('payroll_records')
        .update({
          status: 'submitted',
          gusto_payroll_id: gustoPayrollId,
          gusto_synced_at: new Date().toISOString(),
        })
        .eq('id', rec.id)

      results.push({ profile_id: rec.profile_id, ok: true })
    } catch (e) {
      results.push({ profile_id: rec.profile_id, ok: false, error: (e as Error).message })
    }
  }

  // Update pay period status
  await db
    .from('pay_periods')
    .update({
      status: 'submitted',
      gusto_payroll_id: gustoPayrollId,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', payPeriodId)

  return {
    success: true,
    gusto_payroll_id: gustoPayrollId,
    gusto_review_url: `https://app.gusto.com/payrolls/${gustoPayrollId}`,
    payroll_synced: results.filter((r) => r.ok).length,
    errors: results.filter((r) => !r.ok),
    results,
  }
}

// ---------------------------------------------------------------------------
// Pull results — after Gusto processes, pull actuals back
// ---------------------------------------------------------------------------

async function pullResults(token: string, payPeriodId: string) {
  const db = supabaseAdmin()

  const { data: period } = await db
    .from('pay_periods')
    .select('gusto_payroll_id')
    .eq('id', payPeriodId)
    .single()

  if (!period?.gusto_payroll_id) {
    return { error: 'No Gusto payroll ID on this pay period' }
  }

  const gustoPayrollId = period.gusto_payroll_id as string

  // Fetch the payroll from Gusto
  const res = await fetch(`${gustoApi()}/payrolls/${gustoPayrollId}`, {
    headers: gustoHeaders(token),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gusto get payroll failed: ${res.status} ${text}`)
  }
  const payroll = await res.json()
  const employees = (payroll as { employee_compensations?: Array<{
    employee_uuid: string
    net_pay: number
    taxes: Array<{ name: string; amount: number }>
  }> }).employee_compensations ?? []

  let updated = 0
  for (const emp of employees) {
    // Find the matching payroll_record via profiles.gusto_employee_id
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('gusto_employee_id', emp.employee_uuid)
      .single()

    if (!profile) continue

    const federalTax = emp.taxes?.find((t) => t.name?.toLowerCase().includes('federal'))?.amount ?? 0
    const stateTax = emp.taxes?.find((t) => t.name?.toLowerCase().includes('state'))?.amount ?? 0
    const ssTax = emp.taxes?.find((t) => t.name?.toLowerCase().includes('social'))?.amount ?? 0
    const medicareTax = emp.taxes?.find((t) => t.name?.toLowerCase().includes('medicare'))?.amount ?? 0

    const { error } = await db
      .from('payroll_records')
      .update({
        actual_net_pay: emp.net_pay,
        actual_federal_withholding: federalTax,
        actual_state_withholding: stateTax,
        actual_employee_ss: ssTax,
        actual_employee_medicare: medicareTax,
        status: 'paid',
        gusto_synced_at: new Date().toISOString(),
      })
      .eq('pay_period_id', payPeriodId)
      .eq('profile_id', profile.id)

    if (!error) updated++
  }

  // Update pay period status
  await db
    .from('pay_periods')
    .update({ status: 'closed' })
    .eq('id', payPeriodId)

  return { success: true, records_updated: updated }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const auth = await verifyAuth(req)
  if (!auth || (auth.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'sync-to-gusto')
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

    const { action, pay_period_id, dry_run, company_id } = parsedInput.data

    // Resolve company_id from the user's profile
    const db = supabaseAdmin()
    let resolvedCompanyId = company_id
    if (!resolvedCompanyId) {
      const { data: profile } = await db
        .from('profiles')
        .select('company_id')
        .eq('id', auth.user_id)
        .single()
      resolvedCompanyId = (profile?.company_id as string) ?? auth.user_id
    }

    // Get OAuth token (auto-refreshes if needed)
    const gustoCreds = await getGustoToken(resolvedCompanyId)
    if (!gustoCreds) {
      return new Response(
        JSON.stringify({
          error: 'Gusto not connected',
          message: 'Connect Gusto in Settings > Integrations first.',
        }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    let result: unknown

    if (action === 'push_employees') {
      result = await pushEmployees(gustoCreds.access_token, gustoCreds.company_uuid)
    } else if (action === 'pull_results') {
      result = await pullResults(gustoCreds.access_token, pay_period_id!)
    } else {
      // Default: push payroll
      result = await pushPayroll(
        gustoCreds.access_token,
        gustoCreds.company_uuid,
        pay_period_id!,
        dry_run ?? false,
      )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
