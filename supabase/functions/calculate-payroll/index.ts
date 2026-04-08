// Phase I — calculate-payroll edge function
// Computes a complete payroll record for every active worker for a given pay period.
// Pulls from time_entries, compensation_components, benefits_enrollment, and payroll_adjustments.
// Estimates withholdings for preview only — Gusto computes exact amounts at submit time.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tax constants — stored here as a single source of truth so they can be updated annually.
const SS_WAGE_BASE_2026 = 168600 // estimate; update annually
const SS_RATE = 0.062
const MEDICARE_RATE = 0.0145
const FUTA_RATE = 0.006
const FUTA_WAGE_BASE = 7000
const OHIO_STATE_RATE = 0.035
const PAY_PERIODS_PER_YEAR = 26

type Profile = {
  id: string
  full_name: string
  worker_type: string | null
  pay_type: string | null
  annual_salary: number | null
  hourly_rate: number | null
  overtime_eligible: boolean | null
  filing_status: string | null
  suta_rate: number | null
  termination_date: string | null
  hire_date: string | null
}

type PayPeriod = {
  id: string
  period_start: string
  period_end: string
  pay_date: string
  year: number
}

type Component = {
  id: string
  profile_id: string
  component_type: string
  amount: number
  amount_frequency: string
  is_taxable: boolean
  is_pre_tax: boolean
  effective_from: string
  effective_to: string | null
  is_active: boolean
}

type Benefit = {
  id: string
  profile_id: string
  benefit_type: string
  employee_contribution_amount: number
  employee_contribution_frequency: string
  employer_contribution_amount: number
  employer_contribution_frequency: string
  employee_contribution_percent: number | null
  employer_match_percent: number | null
  is_pre_tax: boolean
  is_active: boolean
  effective_from: string
  effective_to: string | null
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
        query: 'calculate payroll for current pay period',
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

function frequencyToPayPeriodAmount(amount: number, frequency: string, hours: number): number {
  switch (frequency) {
    case 'per_pay_period':
      return amount
    case 'monthly':
      // 26 bi-weekly periods per year, ~2.167 per month
      return (amount * 12) / PAY_PERIODS_PER_YEAR
    case 'annual':
      return amount / PAY_PERIODS_PER_YEAR
    case 'per_hour':
      return amount * hours
    default:
      return amount
  }
}

function getComponentAmount(
  type: string,
  components: Component[],
  period: PayPeriod,
  hours: number,
): number {
  const matched = components.filter((c) => {
    if (c.component_type !== type) return false
    if (!c.is_active) return false
    if (c.effective_from > period.period_end) return false
    if (c.effective_to && c.effective_to < period.period_start) return false
    return true
  })
  return matched.reduce((sum, c) => sum + frequencyToPayPeriodAmount(Number(c.amount), c.amount_frequency, hours), 0)
}

function getBenefitEmployeeAmount(
  benefit: Benefit | undefined,
  grossPay: number,
): number {
  if (!benefit) return 0
  if (benefit.employee_contribution_frequency === 'percent_of_gross' && benefit.employee_contribution_percent != null) {
    return grossPay * (Number(benefit.employee_contribution_percent) / 100)
  }
  return frequencyToPayPeriodAmount(Number(benefit.employee_contribution_amount), benefit.employee_contribution_frequency, 0)
}

function getBenefitEmployerAmount(benefit: Benefit | undefined): number {
  if (!benefit) return 0
  return frequencyToPayPeriodAmount(Number(benefit.employer_contribution_amount), benefit.employer_contribution_frequency, 0)
}

// Very rough federal estimate — bracket-style based on annualized taxable.
// This is for UI preview only. Gusto computes the real number from W-4.
function estimateFederalWithholding(taxableGross: number, filingStatus: string | null): number {
  const annualized = taxableGross * PAY_PERIODS_PER_YEAR
  let rate = 0.12
  if (filingStatus === 'married_jointly') {
    if (annualized < 23200) rate = 0.10
    else if (annualized < 94300) rate = 0.12
    else if (annualized < 201050) rate = 0.22
    else if (annualized < 383900) rate = 0.24
    else rate = 0.32
  } else {
    if (annualized < 11600) rate = 0.10
    else if (annualized < 47150) rate = 0.12
    else if (annualized < 100525) rate = 0.22
    else if (annualized < 191950) rate = 0.24
    else rate = 0.32
  }
  return Math.max(taxableGross * rate * 0.85, 0) // 0.85 fudge factor for std deduction
}

async function calculateW2(
  supabase: ReturnType<typeof createClient>,
  worker: Profile,
  period: PayPeriod,
  ytdGross: number,
  ytdSS: number,
) {
  // 1. Time entries
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('total_minutes, clock_in, clock_out, entry_method, approved_by')
    .eq('user_id', worker.id)
    .gte('clock_in', period.period_start)
    .lte('clock_in', `${period.period_end}T23:59:59`)
    .not('clock_out', 'is', null)

  const validEntries = (timeEntries ?? []).filter(
    (e: { entry_method: string; approved_by: string | null }) =>
      e.entry_method === 'live' || e.approved_by != null,
  )
  const totalMinutes = validEntries.reduce(
    (sum: number, e: { total_minutes: number | null }) => sum + (Number(e.total_minutes) || 0),
    0,
  )
  const totalHoursWorked = totalMinutes / 60

  // 2. Components
  const { data: comps } = await supabase
    .from('compensation_components')
    .select('*')
    .eq('profile_id', worker.id)
    .eq('is_active', true)

  const components = (comps ?? []) as Component[]

  // 3. Benefits
  const { data: benData } = await supabase
    .from('benefits_enrollment')
    .select('*')
    .eq('profile_id', worker.id)
    .eq('is_active', true)

  const benefits = (benData ?? []) as Benefit[]
  const healthBenefit = benefits.find((b) => b.benefit_type === 'health')
  const retirementBenefit = benefits.find(
    (b) => b.benefit_type === 'retirement_simple_ira' || b.benefit_type === 'retirement_401k',
  )

  // 4. Hours split (regular vs OT)
  let regularHours = 0
  let overtimeHours = 0
  if (worker.pay_type === 'hourly') {
    regularHours = Math.min(totalHoursWorked, 80)
    overtimeHours = worker.overtime_eligible ? Math.max(totalHoursWorked - 80, 0) : 0
  } else {
    regularHours = Math.min(totalHoursWorked, 80)
  }

  // 5. Base pay
  let basePay = 0
  if (worker.pay_type === 'salary') {
    basePay = (Number(worker.annual_salary) || 0) / PAY_PERIODS_PER_YEAR
  } else if (worker.pay_type === 'hourly') {
    basePay = regularHours * (Number(worker.hourly_rate) || 0)
  }
  const overtimePay = overtimeHours * (Number(worker.hourly_rate) || 0) * 1.5

  // 6. Allowances
  const vehicleAllowance = getComponentAmount('vehicle_allowance', components, period, totalHoursWorked)
  const phoneStipend = getComponentAmount('phone_stipend', components, period, totalHoursWorked)
  const otherAllowances =
    getComponentAmount('other_recurring', components, period, totalHoursWorked) +
    getComponentAmount('tool_allowance', components, period, totalHoursWorked)

  // 7. One-time adjustments
  const { data: adjData } = await supabase
    .from('payroll_adjustments')
    .select('*')
    .eq('profile_id', worker.id)
    .eq('pay_period_id', period.id)

  const adjustments = (adjData ?? []) as Array<{ adjustment_type: string; amount: number; is_taxable: boolean }>

  const bonusAmount = adjustments
    .filter((a) => a.adjustment_type === 'bonus' || a.adjustment_type === 'commission')
    .reduce((s, a) => s + Number(a.amount), 0)

  const otherAdditions = adjustments
    .filter((a) => a.adjustment_type === 'other_addition' || (a.adjustment_type === 'expense_reimbursement' && a.is_taxable))
    .reduce((s, a) => s + Number(a.amount), 0)

  const otherAdjDeductions = adjustments
    .filter(
      (a) =>
        a.adjustment_type === 'other_deduction' ||
        a.adjustment_type === 'garnishment' ||
        a.adjustment_type === 'advance_repayment',
    )
    .reduce((s, a) => s + Math.abs(Number(a.amount)), 0)

  const grossPay = basePay + overtimePay + vehicleAllowance + phoneStipend + otherAllowances + bonusAmount + otherAdditions

  // 8. Benefit deductions
  const healthDeduction = getBenefitEmployeeAmount(healthBenefit, grossPay)
  const retirementDeduction = getBenefitEmployeeAmount(retirementBenefit, grossPay)

  // 9. Employer benefit costs
  const employerHealthCost =
    getBenefitEmployerAmount(healthBenefit) +
    getComponentAmount('health_employer', components, period, totalHoursWorked)
  const employerRetirementCost =
    getBenefitEmployerAmount(retirementBenefit) +
    getComponentAmount('retirement_employer', components, period, totalHoursWorked)

  // 10. Estimated withholdings (Gusto calculates exact)
  const taxableGross = grossPay - healthDeduction - retirementDeduction
  const estFederal = estimateFederalWithholding(taxableGross, worker.filing_status)
  const estState = taxableGross * OHIO_STATE_RATE

  const ssRoom = Math.max(SS_WAGE_BASE_2026 - ytdGross, 0)
  const ssTaxable = Math.min(taxableGross, ssRoom)
  const estEmployeeSS = ssTaxable * SS_RATE
  const estEmployeeMedicare = taxableGross * MEDICARE_RATE

  const totalDeductions = healthDeduction + retirementDeduction + estFederal + estState + estEmployeeSS + estEmployeeMedicare + otherAdjDeductions

  // 11. Employer taxes
  const employerSS = estEmployeeSS
  const employerMedicare = estEmployeeMedicare
  const futaRoom = Math.max(FUTA_WAGE_BASE - ytdGross, 0)
  const employerFUTA = Math.min(grossPay, futaRoom) * FUTA_RATE
  const employerSUTA = grossPay * (Number(worker.suta_rate) || 0.027)

  const estNetPay = grossPay - totalDeductions
  const totalEmployerCost =
    grossPay + employerHealthCost + employerRetirementCost + employerSS + employerMedicare + employerFUTA + employerSUTA

  return {
    pay_period_id: period.id,
    profile_id: worker.id,
    worker_type: worker.worker_type ?? 'w2_fulltime',
    regular_hours: round2(regularHours),
    overtime_hours: round2(overtimeHours),
    pto_hours: 0,
    holiday_hours: 0,
    total_hours: round2(regularHours + overtimeHours),
    base_pay: round2(basePay),
    overtime_pay: round2(overtimePay),
    vehicle_allowance: round2(vehicleAllowance),
    phone_stipend: round2(phoneStipend),
    other_allowances: round2(otherAllowances + otherAdditions),
    bonus_amount: round2(bonusAmount),
    gross_pay: round2(grossPay),
    health_deduction: round2(healthDeduction),
    retirement_deduction: round2(retirementDeduction),
    other_deductions: round2(otherAdjDeductions),
    total_deductions: round2(totalDeductions),
    employer_health_cost: round2(employerHealthCost),
    employer_retirement_cost: round2(employerRetirementCost),
    employer_ss_tax: round2(employerSS),
    employer_medicare_tax: round2(employerMedicare),
    employer_futa: round2(employerFUTA),
    employer_suta: round2(employerSUTA),
    total_employer_cost: round2(totalEmployerCost),
    est_federal_withholding: round2(estFederal),
    est_state_withholding: round2(estState),
    est_employee_ss: round2(estEmployeeSS),
    est_employee_medicare: round2(estEmployeeMedicare),
    est_net_pay: round2(estNetPay),
    contractor_payment: 0,
    status: 'calculated' as const,
  }
}

async function calculate1099(
  supabase: ReturnType<typeof createClient>,
  worker: Profile,
  period: PayPeriod,
) {
  const { data: adjData } = await supabase
    .from('payroll_adjustments')
    .select('*')
    .eq('profile_id', worker.id)
    .eq('pay_period_id', period.id)

  const payments = (adjData ?? []) as Array<{ amount: number; description: string }>
  const contractorPayment = payments.reduce((s, a) => s + Number(a.amount), 0)
  const memo = payments.map((a) => a.description).join(' · ')

  return {
    pay_period_id: period.id,
    profile_id: worker.id,
    worker_type: 'contractor_1099',
    regular_hours: 0,
    overtime_hours: 0,
    pto_hours: 0,
    holiday_hours: 0,
    total_hours: 0,
    base_pay: 0,
    overtime_pay: 0,
    vehicle_allowance: 0,
    phone_stipend: 0,
    other_allowances: 0,
    bonus_amount: 0,
    gross_pay: round2(contractorPayment),
    health_deduction: 0,
    retirement_deduction: 0,
    other_deductions: 0,
    total_deductions: 0,
    employer_health_cost: 0,
    employer_retirement_cost: 0,
    employer_ss_tax: 0,
    employer_medicare_tax: 0,
    employer_futa: 0,
    employer_suta: 0,
    total_employer_cost: round2(contractorPayment),
    est_federal_withholding: 0,
    est_state_withholding: 0,
    est_employee_ss: 0,
    est_employee_medicare: 0,
    est_net_pay: round2(contractorPayment),
    contractor_payment: round2(contractorPayment),
    contractor_payment_memo: memo,
    status: 'calculated' as const,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'calculate-payroll')
  if (!rl.allowed) return rateLimitResponse(rl)

  // Always assemble context first
  await callAssembleContext('calculate-payroll')

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

    const { data: period, error: periodErr } = await supabase
      .from('pay_periods')
      .select('*')
      .eq('id', pay_period_id)
      .single()
    if (periodErr || !period) throw new Error('Pay period not found')

    const { data: workersData } = await supabase
      .from('profiles')
      .select('*')
      .in('worker_type', ['w2_fulltime', 'w2_parttime', 'contractor_1099', 'owner'])

    const workers = (workersData ?? []) as Profile[]

    const records: ReturnType<typeof round2>[] | unknown[] = []
    for (const w of workers) {
      // Skip terminated workers whose end date is before the period
      if (w.termination_date && w.termination_date < (period as PayPeriod).period_start) continue

      const { data: ytd } = await supabase
        .from('payroll_ytd')
        .select('gross_pay_ytd, employee_ss_ytd')
        .eq('profile_id', w.id)
        .eq('year', (period as PayPeriod).year)
        .maybeSingle()

      const ytdGross = Number(ytd?.gross_pay_ytd ?? 0)
      const ytdSS = Number(ytd?.employee_ss_ytd ?? 0)

      const record =
        w.worker_type === 'contractor_1099'
          ? await calculate1099(supabase, w, period as PayPeriod)
          : await calculateW2(supabase, w, period as PayPeriod, ytdGross, ytdSS)

      records.push(record)
    }

    // Upsert calculated records (replace any existing 'calculated' rows for this period)
    for (const rec of records) {
      const r = rec as Record<string, unknown>
      const { data: existing } = await supabase
        .from('payroll_records')
        .select('id, status')
        .eq('pay_period_id', r.pay_period_id)
        .eq('profile_id', r.profile_id)
        .maybeSingle()

      if (existing && (existing.status === 'approved' || existing.status === 'submitted' || existing.status === 'paid')) {
        continue // do not overwrite approved or downstream records
      }

      if (existing) {
        await supabase.from('payroll_records').update(r).eq('id', existing.id)
      } else {
        await supabase.from('payroll_records').insert(r)
      }
    }

    return new Response(
      JSON.stringify({ success: true, pay_period_id, records_count: records.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
