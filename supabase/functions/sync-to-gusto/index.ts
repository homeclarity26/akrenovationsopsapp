// Phase I — sync-to-gusto edge function
// Pushes approved payroll_records to Gusto via the Gusto API.
// Does NOT auto-submit in Gusto — Adam reviews and clicks Submit there.
//
// Required env vars:
//   GUSTO_API_KEY      — from Gusto developer dashboard (Settings → API)
//   GUSTO_COMPANY_ID   — your Gusto company UUID

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  pay_period_id: z.string().uuid('pay_period_id must be a valid UUID'),
  dry_run: z.boolean().optional(),
})

const GUSTO_API = 'https://api.gusto.com/v1'

function gustoHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get('GUSTO_API_KEY') ?? ''}`,
    'Content-Type': 'application/json',
  }
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
        capability_required: 'submit_payroll_to_gusto',
        query: 'sync approved payroll to Gusto',
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

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
  profiles?: { gusto_employee_id: string | null; gusto_contractor_id: string | null; full_name: string }
}

async function createOrGetGustoPayroll(periodStart: string, periodEnd: string, payDate: string) {
  const companyId = Deno.env.get('GUSTO_COMPANY_ID') ?? ''
  const res = await fetch(`${GUSTO_API}/companies/${companyId}/payrolls`, {
    method: 'POST',
    headers: gustoHeaders(),
    body: JSON.stringify({
      start_date: periodStart,
      end_date: periodEnd,
      check_date: payDate,
      off_cycle: false,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gusto createPayroll failed: ${res.status} ${text}`)
  }
  return await res.json()
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
  // For salaried workers Gusto uses fixed compensation; for hourly we send hours.
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

async function updateGustoEmployeeCompensation(rec: PayrollRecord, gustoPayrollId: string) {
  const empId = rec.profiles?.gusto_employee_id
  if (!empId) {
    console.warn(`Skipping ${rec.profiles?.full_name} — no gusto_employee_id`)
    return { skipped: true, reason: 'no gusto_employee_id' }
  }
  const res = await fetch(
    `${GUSTO_API}/payrolls/${gustoPayrollId}/employees/${empId}/compensations`,
    {
      method: 'PUT',
      headers: gustoHeaders(),
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
    throw new Error(`Gusto compensation update failed for ${empId}: ${res.status} ${text}`)
  }
  return await res.json()
}

async function updateGustoContractorPayment(rec: PayrollRecord, _gustoPayrollId: string) {
  const contractorId = rec.profiles?.gusto_contractor_id
  if (!contractorId) {
    console.warn(`Skipping contractor ${rec.profiles?.full_name} — no gusto_contractor_id`)
    return { skipped: true, reason: 'no gusto_contractor_id' }
  }
  const res = await fetch(`${GUSTO_API}/contractors/${contractorId}/contractor_payments`, {
    method: 'POST',
    headers: gustoHeaders(),
    body: JSON.stringify({
      wage: rec.contractor_payment,
      reimbursement: 0,
      bonus: 0,
      hours: 0,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gusto contractor payment failed for ${contractorId}: ${res.status} ${text}`)
  }
  return await res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'sync-to-gusto')
  if (!rl.allowed) return rateLimitResponse(rl)

  await callAssembleContext('sync-to-gusto')

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { pay_period_id, dry_run } = parsedInput.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: period, error: periodErr } = await supabase
      .from('pay_periods')
      .select('*')
      .eq('id', pay_period_id)
      .single()
    if (periodErr || !period) throw new Error('Pay period not found')

    const { data: records } = await supabase
      .from('payroll_records')
      .select('*, profiles(full_name, gusto_employee_id, gusto_contractor_id)')
      .eq('pay_period_id', pay_period_id)
      .eq('status', 'approved')

    const recs = (records ?? []) as PayrollRecord[]
    if (recs.length === 0) {
      return new Response(JSON.stringify({ error: 'No approved records to sync' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({ dry_run: true, would_sync: recs.length, records: recs.map((r) => r.profiles?.full_name) }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const gustoApiKey = Deno.env.get('GUSTO_API_KEY')
    if (!gustoApiKey) throw new Error('GUSTO_API_KEY not configured')

    const gustoPayroll = await createOrGetGustoPayroll(
      period.period_start as string,
      period.period_end as string,
      period.pay_date as string,
    )

    const results: Array<unknown> = []
    for (const rec of recs) {
      try {
        const result =
          rec.worker_type === 'contractor_1099'
            ? await updateGustoContractorPayment(rec, gustoPayroll.id)
            : await updateGustoEmployeeCompensation(rec, gustoPayroll.id)
        results.push({ profile_id: rec.profile_id, ok: true, result })

        await supabase
          .from('payroll_records')
          .update({ status: 'submitted', gusto_employee_compensation_id: (result as { id?: string })?.id ?? null })
          .eq('id', rec.id)
      } catch (e) {
        results.push({ profile_id: rec.profile_id, ok: false, error: (e as Error).message })
      }
    }

    await supabase
      .from('pay_periods')
      .update({
        status: 'submitted',
        gusto_payroll_id: gustoPayroll.id,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', pay_period_id)

    return new Response(
      JSON.stringify({
        success: true,
        gusto_payroll_id: gustoPayroll.id,
        gusto_review_url: `https://app.gusto.com/payrolls/${gustoPayroll.id}`,
        results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
