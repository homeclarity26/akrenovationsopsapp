import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  MOCK_PAYROLL_WORKERS,
  MOCK_COMPENSATION_COMPONENTS,
  MOCK_BENEFITS_ENROLLMENT,
  MOCK_PAYROLL_RECORDS,
  MOCK_PAY_PERIODS,
  MOCK_PAYROLL_YTD,
} from '@/data/mock'
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

export function WorkerSetupPage() {
  const { workerId } = useParams<{ workerId: string }>()
  const worker = MOCK_PAYROLL_WORKERS.find((w) => w.profile_id === workerId)
  const [tab, setTab] = useState<Tab>('Details')

  const components = useMemo(() => MOCK_COMPENSATION_COMPONENTS.filter((c) => c.profile_id === workerId), [workerId])
  const benefits = useMemo(() => MOCK_BENEFITS_ENROLLMENT.filter((b) => b.profile_id === workerId), [workerId])
  const records = useMemo(() => MOCK_PAYROLL_RECORDS.filter((r) => r.profile_id === workerId), [workerId])
  const ytd = useMemo(() => MOCK_PAYROLL_YTD.find((y) => y.profile_id === workerId), [workerId])

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
            {worker.worker_type.replace('_', ' ')} · {worker.pay_type ?? '—'}
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
      {tab === 'History' && <HistoryTab records={records} />}
      {tab === 'YTD' && <YTDTab ytd={ytd} />}
    </div>
  )
}

function DetailsTab({ worker }: { worker: (typeof MOCK_PAYROLL_WORKERS)[number] }) {
  return (
    <Card padding="lg" className="space-y-3">
      <Field label="Worker type" value={worker.worker_type.replace('_', ' ')} />
      <Field label="Hire date" value={new Date(`${worker.hire_date}T00:00:00`).toLocaleDateString('en-US')} />
      {worker.termination_date && (
        <Field label="Termination date" value={new Date(`${worker.termination_date}T00:00:00`).toLocaleDateString('en-US')} />
      )}
      <Field label="Pay type" value={worker.pay_type ?? '—'} />
      {worker.pay_type === 'salary' ? (
        <Field label="Annual salary" value={fmtCurrency0(worker.annual_salary)} mono />
      ) : (
        <Field label="Hourly rate" value={fmtCurrency(worker.hourly_rate)} mono />
      )}
      <Field label="Standard hours / week" value={`${worker.standard_hours_per_week}`} mono />
      <Field label="Overtime eligible" value={worker.overtime_eligible ? 'Yes' : 'No'} />
      <Field label="Filing status" value={worker.filing_status.replace('_', ' ')} />
      <Field label="Pay frequency" value={worker.pay_frequency} />
      <Field label="SUTA rate (Ohio)" value={`${(worker.suta_rate * 100).toFixed(2)}%`} mono />
      <Field label="Gusto employee ID" value={worker.gusto_employee_id ?? 'Not synced'} />
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

function BenefitsTab({ benefits }: { benefits: typeof MOCK_BENEFITS_ENROLLMENT }) {
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
                Employee: {b.employee_contribution_percent != null ? `${b.employee_contribution_percent}% of gross` : `${fmtCurrency(b.employee_contribution_amount)} ${b.employee_contribution_frequency.replace('_', ' ')}`}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                Employer: {fmtCurrency(b.employer_contribution_amount)} {b.employer_contribution_frequency.replace('_', ' ')}
              </p>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function HistoryTab({ records }: { records: typeof MOCK_PAYROLL_RECORDS }) {
  return (
    <Card padding="none">
      {records.length === 0 ? (
        <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No payroll history yet</div>
      ) : (
        records.map((r) => {
          const period = MOCK_PAY_PERIODS.find((p) => p.id === r.pay_period_id)
          return (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)] last:border-0"
            >
              <div>
                <p className="font-medium text-sm text-[var(--text)]">
                  {period
                    ? `${new Date(`${period.period_start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${period.period_end}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : '—'}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{r.status}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-[var(--text)]">{fmtCurrency(r.gross_pay)}</p>
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono">~{fmtCurrency(r.est_net_pay)} net</p>
              </div>
            </div>
          )
        })
      )}
    </Card>
  )
}

function YTDTab({ ytd }: { ytd: (typeof MOCK_PAYROLL_YTD)[number] | undefined }) {
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
          New workers must also be added to Gusto for tax filing and direct deposit. AK Ops can sync this automatically once Gusto integration is configured.
        </div>
      </Card>
    </div>
  )
}
