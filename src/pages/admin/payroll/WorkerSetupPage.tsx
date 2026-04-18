import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CompensationComponent } from '@/data/mock'

const TAB_LABELS = ['Details', 'Compensation', 'Benefits', 'History', 'YTD'] as const
type Tab = (typeof TAB_LABELS)[number]

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function fmtCurrency0(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const COMPONENT_LABEL: Record<string, string> = {
  base_salary: 'Base salary',
  hourly_base: 'Hourly base',
  vehicle_allowance: 'Vehicle allowance',
  health_employer: 'Health (employer)',
  retirement_employer: 'Retirement (employer)',
  phone_stipend: 'Phone stipend',
  tool_allowance: 'Tool allowance',
  other_recurring: 'Other recurring',
}

const FREQUENCY_LABEL: Record<string, string> = {
  per_hour: '/hour',
  per_pay_period: '/pay period',
  monthly: '/month',
  annual: '/year',
}

type WorkerProfile = { id: string; full_name: string; role: string; email?: string; start_date?: string; hourly_rate?: number; base_salary?: number; phone?: string }
type PayrollRecordRow = { id: string; pay_period_id: string; gross_pay: number; est_net_pay: number; total_hours: number; status: string; regular_hours: number; overtime_hours: number; pto_hours?: number; base_pay: number; overtime_pay: number; vehicle_allowance: number; phone_stipend?: number; other_allowances?: number; bonus_amount: number; health_deduction: number; retirement_deduction: number; other_deductions: number; total_deductions: number; est_federal_withholding: number; est_state_withholding: number; est_employee_ss: number; est_employee_medicare: number; employer_health_cost: number; employer_retirement_cost: number; employer_ss_tax: number; employer_medicare_tax: number; employer_futa: number; employer_suta: number; total_employer_cost: number; contractor_payment: number }

export function WorkerSetupPage() {
  const { workerId } = useParams<{ workerId: string }>()
  const [tab, setTab] = useState<Tab>('Details')

  const { data: worker, isLoading: workerLoading, error: workerError, refetch: workerRefetch } = useQuery({
    queryKey: ['worker_profile', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', workerId).single()
      return data as WorkerProfile | null
    },
  })

  const { data: components = [] } = useQuery({
    queryKey: ['compensation_components', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data } = await supabase.from('compensation_components').select('*').eq('profile_id', workerId)
      return (data ?? []) as CompensationComponent[]
    },
  })

  const { data: benefits = [] } = useQuery({
    queryKey: ['benefits_enrollment', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data } = await supabase.from('benefits_enrollment').select('*').eq('profile_id', workerId)
      return data ?? []
    },
  })

  const { data: records = [] } = useQuery({
    queryKey: ['worker_payroll_records', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data } = await supabase.from('payroll_records').select('*').eq('profile_id', workerId).order('created_at', { ascending: false })
      return (data ?? []) as PayrollRecordRow[]
    },
  })

  const ytd = useMemo(() => {
    // Compute YTD from records since there may not be a separate ytd table
    if (records.length === 0) return null
    const gross = records.reduce((s, r) => s + (r.gross_pay ?? 0), 0)
    const net = records.reduce((s, r) => s + (r.est_net_pay ?? 0), 0)
    const federal = records.reduce((s, r) => s + (r.est_federal_withholding ?? 0), 0)
    const state = records.reduce((s, r) => s + (r.est_state_withholding ?? 0), 0)
    const ss = records.reduce((s, r) => s + (r.est_employee_ss ?? 0), 0)
    const medicare = records.reduce((s, r) => s + (r.est_employee_medicare ?? 0), 0)
    return {
      year: new Date().getFullYear(),
      gross_pay_ytd: gross,
      net_pay_ytd: net,
      federal_withholding_ytd: federal,
      state_withholding_ytd: state,
      employee_ss_ytd: ss,
      employee_medicare_ytd: medicare,
      retirement_employee_ytd: 0,
      retirement_employer_ytd: 0,
      health_employee_ytd: 0,
      health_employer_ytd: 0,
    }
  }, [records])

  if (workerLoading) {
    return (
      <div className="px-4 lg:px-8 py-8 max-w-3xl mx-auto">
        <p className="text-sm text-[var(--text-tertiary)]">Loading worker…</p>
      </div>
    )
  }

  if (workerError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load worker. Check your connection and try again.</p>
      <button onClick={() => workerRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (!worker) {
    return (
      <div className="px-4 lg:px-8 py-8 max-w-3xl mx-auto">
        <p className="text-sm text-[var(--text-tertiary)]">Worker not found.</p>
        <Link to="/admin/payroll/workers" className="text-[var(--rust)] text-sm">
          Back to Workers
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-4xl mx-auto">
      <Link
        to="/admin/payroll/workers"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)]"
      >
        <ArrowLeft size={14} />
        Workers
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight text-[var(--navy)]">{worker.full_name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5 capitalize">
            {worker.role}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-light)] overflow-x-auto">
        {TAB_LABELS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              tab === t
                ? 'border-[var(--rust)] text-[var(--rust)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--navy)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Details' && <DetailsTab worker={worker} />}
      {tab === 'Compensation' && <CompensationTab components={components} />}
      {tab === 'Benefits' && <BenefitsTab benefits={benefits} />}
      {tab === 'History' && <HistoryTab records={records as PayrollRecordRow[]} />}
      {tab === 'YTD' && <YTDTab ytd={ytd} />}
    </div>
  )
}

function DetailsTab({ worker }: { worker: WorkerProfile }) {
  return (
    <Card padding="lg" className="space-y-3">
      <Field label="Role" value={worker.role} />
      {worker.start_date && (
        <Field label="Start date" value={new Date(`${worker.start_date}T00:00:00`).toLocaleDateString('en-US')} />
      )}
      {worker.email && <Field label="Email" value={worker.email} />}
      {worker.base_salary != null ? (
        <Field label="Annual salary" value={fmtCurrency0(worker.base_salary)} mono />
      ) : worker.hourly_rate != null ? (
        <Field label="Hourly rate" value={fmtCurrency(worker.hourly_rate)} mono />
      ) : null}
      <Field label="Pay frequency" value="Bi-weekly" />
    </Card>
  )
}

function CompensationTab({ components }: { components: CompensationComponent[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Active compensation components</p>
        <Button variant="secondary" size="sm" onClick={() => alert('Add compensation component (slide-over)')}>
          <Plus size={14} />
          Add component
        </Button>
      </div>
      <Card padding="none">
        {components.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No components yet</div>
        ) : (
          components.map((c) => (
            <div
              key={c.id}
              className="px-4 py-3.5 border-b border-[var(--border-light)] last:border-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-sm text-[var(--text)]">{COMPONENT_LABEL[c.component_type]}</span>
                    {c.is_taxable && (
                      <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--warning)] bg-[var(--warning-bg)] px-1.5 py-0.5 rounded">
                        Taxable
                      </span>
                    )}
                    {c.is_pre_tax && (
                      <span className="text-[10px] uppercase font-semibold tracking-wide text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        Pre-tax
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                    {fmtCurrency(c.amount)}
                    {FREQUENCY_LABEL[c.amount_frequency]} · effective {c.effective_from}
                  </p>
                  {c.notes && <p className="text-[11px] text-[var(--text-secondary)] mt-1">{c.notes}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

type BenefitRow = { id: string; benefit_type: string; is_pre_tax?: boolean; plan_name?: string; carrier?: string; employee_contribution_percent?: number; employee_contribution_amount?: number; employee_contribution_frequency?: string; employer_contribution_amount?: number; employer_contribution_frequency?: string }

function BenefitsTab({ benefits }: { benefits: BenefitRow[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Benefits enrollment</p>
        <Button variant="secondary" size="sm" onClick={() => alert('Add benefit (slide-over)')}>
          <Plus size={14} />
          Add benefit
        </Button>
      </div>
      <Card padding="none">
        {benefits.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No benefits enrolled</div>
        ) : (
          benefits.map((b) => (
            <div
              key={b.id}
              className="px-4 py-3.5 border-b border-[var(--border-light)] last:border-0 space-y-1"
            >
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-medium text-sm text-[var(--text)] capitalize">
                  {b.benefit_type.replace(/_/g, ' ')}
                </span>
                {b.is_pre_tax && (
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    Pre-tax
                  </span>
                )}
                <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--success)] bg-[var(--success-bg)] px-1.5 py-0.5 rounded">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Plan: <span className="font-medium text-[var(--text)]">{b.plan_name}</span> · {b.carrier}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                Employee: {b.employee_contribution_percent != null ? `${b.employee_contribution_percent}% of gross` : b.employee_contribution_amount != null ? `${fmtCurrency(b.employee_contribution_amount)} ${(b.employee_contribution_frequency ?? '').replace('_', ' ')}` : '—'}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                Employer: {b.employer_contribution_amount != null ? `${fmtCurrency(b.employer_contribution_amount)} ${(b.employer_contribution_frequency ?? '').replace('_', ' ')}` : '—'}
              </p>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function HistoryTab({ records }: { records: PayrollRecordRow[] }) {
  return (
    <Card padding="none">
      {records.length === 0 ? (
        <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No payroll history yet</div>
      ) : (
        records.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)] last:border-0"
          >
            <div>
              <p className="font-medium text-sm text-[var(--text)]">Pay period {r.pay_period_id.slice(-8)}</p>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{r.status}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-[var(--text)]">{fmtCurrency(r.gross_pay)}</p>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">~{fmtCurrency(r.est_net_pay)} net</p>
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

type YTDData = { year: number; gross_pay_ytd: number; net_pay_ytd: number; federal_withholding_ytd: number; state_withholding_ytd: number; employee_ss_ytd: number; employee_medicare_ytd: number; retirement_employee_ytd: number; retirement_employer_ytd: number; health_employee_ytd: number; health_employer_ytd: number }

function YTDTab({ ytd }: { ytd: YTDData | null | undefined }) {
  if (!ytd) {
    return <Card padding="lg"><p className="text-sm text-[var(--text-tertiary)]">No YTD data yet</p></Card>
  }
  return (
    <Card padding="lg" className="space-y-3">
      <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body">
        Year {ytd.year}
      </p>
      <Field label="Gross pay" value={fmtCurrency(ytd.gross_pay_ytd)} mono />
      <Field label="Federal withholding" value={fmtCurrency(ytd.federal_withholding_ytd)} mono />
      <Field label="State withholding" value={fmtCurrency(ytd.state_withholding_ytd)} mono />
      <Field label="Social Security (employee)" value={fmtCurrency(ytd.employee_ss_ytd)} mono />
      <Field label="Medicare (employee)" value={fmtCurrency(ytd.employee_medicare_ytd)} mono />
      <Field label="Retirement (employee)" value={fmtCurrency(ytd.retirement_employee_ytd)} mono />
      <Field label="Retirement (employer)" value={fmtCurrency(ytd.retirement_employer_ytd)} mono />
      <Field label="Health (employee)" value={fmtCurrency(ytd.health_employee_ytd)} mono />
      <Field label="Health (employer)" value={fmtCurrency(ytd.health_employer_ytd)} mono />
      <div className="border-t border-[var(--border-light)] pt-2">
        <Field label="Net pay" value={fmtCurrency(ytd.net_pay_ytd)} mono bold />
      </div>
    </Card>
  )
}

function Field({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={mono ? 'font-mono text-[var(--text)]' : 'text-[var(--text)]'}>{value}</span>
    </div>
  )
}

export function NewWorkerPage() {
  const [name, setName] = useState('')
  const [type, setType] = useState<'w2_fulltime' | 'w2_parttime' | 'contractor_1099' | 'owner'>('w2_fulltime')
  const [payType, setPayType] = useState<'salary' | 'hourly'>('salary')
  const [salary, setSalary] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [hireDate, setHireDate] = useState('')

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-2xl mx-auto">
      <Link
        to="/admin/payroll/workers"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)]"
      >
        <ArrowLeft size={14} />
        Workers
      </Link>

      <h1 className="font-display text-[26px] leading-tight text-[var(--navy)]">New worker</h1>

      <Card padding="lg" className="space-y-4">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mike Johnson" />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text)]">Worker type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
          >
            <option value="w2_fulltime">W-2 Full-time employee</option>
            <option value="w2_parttime">W-2 Part-time employee</option>
            <option value="contractor_1099">1099 Contractor</option>
            <option value="owner">Owner (S-corp salary)</option>
          </select>
        </div>

        {type !== 'contractor_1099' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text)]">Pay type</label>
              <div className="flex gap-2">
                {(['salary', 'hourly'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPayType(p)}
                    className={`flex-1 px-3 py-2.5 rounded-[10px] border text-sm capitalize ${
                      payType === p
                        ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                        : 'border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {payType === 'salary' ? (
              <Input
                label="Annual salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="80000"
                hint="USD per year"
              />
            ) : (
              <Input
                label="Hourly rate"
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="35"
                hint="USD per hour"
              />
            )}
          </>
        )}

        <Input label="Hire date" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />

        <div className="flex gap-2">
          <Link to="/admin/payroll/workers" className="flex-1">
            <Button variant="secondary" size="md" fullWidth>
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => alert('Worker would be created and synced to Gusto.')}
          >
            Create worker
          </Button>
        </div>

        <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--cream-light)] rounded-lg px-3 py-2">
          New workers must also be added to Gusto for tax filing and direct deposit. TradeOffice AI can sync this automatically once Gusto integration is configured.
        </div>
      </Card>
    </div>
  )
}
