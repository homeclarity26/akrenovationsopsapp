import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
  Send,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusPill } from '@/components/ui/StatusPill'
import { Input } from '@/components/ui/Input'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PayrollAdjustment, PayrollRecord, PayrollRecordStatus } from '@/data/mock'

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const WORKER_TYPE_LABEL: Record<string, string> = {
  w2_fulltime: 'Full-time',
  w2_parttime: 'Part-time',
  contractor_1099: '1099',
  owner: 'Owner (W-2)',
}

type PayPeriodRow = { id: string; status: string; period_start: string; period_end: string; pay_date: string; period_number: number; year: number }
type WorkerRow = { profile_id: string; full_name: string; worker_type: string; pay_type?: string }

export function PayPeriodDetailPage() {
  const { periodId } = useParams<{ periodId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: period, error: periodError, refetch: periodRefetch } = useQuery({
    queryKey: ['pay_period', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data } = await supabase.from('pay_periods').select('*').eq('id', periodId).single()
      return data as PayPeriodRow | null
    },
  })

  const { data: fetchedRecords = [] } = useQuery({
    queryKey: ['payroll_records_period', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data } = await supabase.from('payroll_records').select('*').eq('pay_period_id', periodId)
      return (data ?? []) as PayrollRecord[]
    },
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['payroll_workers'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['employee', 'admin'])
      // Map profiles to worker-shape expected by UI
      return (data ?? []).map((p: { id: string; full_name: string; role: string }) => ({
        profile_id: p.id,
        full_name: p.full_name,
        worker_type: p.role === 'admin' ? 'owner' : 'w2_fulltime',
        pay_type: 'salary',
      })) as WorkerRow[]
    },
  })

  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [, setAdjustments] = useState<PayrollAdjustment[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adjustmentFor, setAdjustmentFor] = useState<string | null>(null)

  // Sync fetched records into local state
  useEffect(() => {
    if (fetchedRecords.length > 0) setRecords(fetchedRecords)
  }, [fetchedRecords])

  useEffect(() => {
    if (searchParams.get('addAdj') === '1' && records.length > 0) {
      setAdjustmentFor(records[0].profile_id)
      searchParams.delete('addAdj')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, records, setSearchParams])

  const issues = useMemo(() => {
    const list: { kind: string; label: string }[] = []
    for (const r of records) {
      const w = workers.find((x) => x.profile_id === r.profile_id)
      if (!w) continue
      if (w.worker_type === 'contractor_1099') {
        if ((r.contractor_payment ?? 0) === 0) {
          list.push({ kind: 'no-pay', label: `${w.full_name}: no contractor payment entered` })
        }
      } else {
        if (r.total_hours === 0 && w.pay_type === 'hourly') {
          list.push({ kind: 'zero-hours', label: `${w.full_name}: zero hours this period` })
        }
      }
    }
    return list
  }, [records, workers])

  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        acc.gross += r.gross_pay
        acc.deductions += r.total_deductions - (r.est_federal_withholding + r.est_state_withholding + r.est_employee_ss + r.est_employee_medicare)
        acc.netEst += r.est_net_pay
        acc.empBenefits += r.employer_health_cost + r.employer_retirement_cost
        acc.empTaxes += r.employer_ss_tax + r.employer_medicare_tax + r.employer_futa + r.employer_suta
        acc.contractors += r.contractor_payment
        acc.totalCost += r.total_employer_cost
        return acc
      },
      { gross: 0, deductions: 0, netEst: 0, empBenefits: 0, empTaxes: 0, contractors: 0, totalCost: 0 },
    )
  }, [records])

  const approvedCount = records.filter((r) => r.status === 'approved' || r.status === 'submitted' || r.status === 'paid').length
  const allApproved = approvedCount === records.length && records.length > 0

  function toggleExpand(profileId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(profileId)) next.delete(profileId)
      else next.add(profileId)
      return next
    })
  }

  function setRecordStatus(profileId: string, status: PayrollRecordStatus) {
    setRecords((prev) =>
      prev.map((r) =>
        r.profile_id === profileId
          ? { ...r, status, approved_at: status === 'approved' ? new Date().toISOString() : r.approved_at }
          : r,
      ),
    )
  }

  function handleAddAdjustment(adj: Omit<PayrollAdjustment, 'id' | 'created_at' | 'pay_period_id'>) {
    if (!period) return
    const full: PayrollAdjustment = {
      ...adj,
      id: `adj-${Date.now()}`,
      pay_period_id: period.id,
      created_at: new Date().toISOString(),
    }
    setAdjustments((prev) => [...prev, full])
    // Apply to record
    setRecords((prev) =>
      prev.map((r) => {
        if (r.profile_id !== adj.profile_id) return r
        if (r.worker_type === 'contractor_1099') {
          const newPayment = r.contractor_payment + adj.amount
          return {
            ...r,
            contractor_payment: newPayment,
            gross_pay: newPayment,
            est_net_pay: newPayment,
            total_employer_cost: newPayment,
            contractor_payment_memo: [r.contractor_payment_memo, adj.description].filter(Boolean).join(' · '),
            status: 'calculated',
          }
        }
        const isAddition = adj.adjustment_type !== 'garnishment' && adj.adjustment_type !== 'advance_repayment' && adj.adjustment_type !== 'other_deduction'
        const delta = isAddition ? Math.abs(adj.amount) : -Math.abs(adj.amount)
        return {
          ...r,
          bonus_amount: adj.adjustment_type === 'bonus' ? r.bonus_amount + delta : r.bonus_amount,
          gross_pay: r.gross_pay + delta,
          est_net_pay: r.est_net_pay + delta,
          total_employer_cost: r.total_employer_cost + delta,
          status: 'calculated',
        }
      }),
    )
    setAdjustmentFor(null)
  }

  if (periodError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load pay period. Check your connection and try again.</p>
      <button onClick={() => periodRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (!period) {
    return (
      <div className="px-4 lg:px-8 py-8 max-w-3xl mx-auto">
        <p className="text-sm text-[var(--text-tertiary)]">Pay period not found.</p>
        <Link to="/admin/payroll" className="text-[var(--rust)] text-sm">
          Back to Payroll
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-5xl mx-auto pb-32">
      <Link to="/admin/payroll" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)]">
        <ArrowLeft size={14} />
        Payroll
      </Link>

      {/* Banner */}
      <Card padding="lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-1">
              Pay period
            </p>
            <p className="font-display text-2xl text-[var(--navy)]">
              {fmtDate(period.period_start)} – {fmtDate(period.period_end)}, {period.year}
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1 font-mono">
              Pay date: {fmtDate(period.pay_date)} · Period {period.period_number} of 26
            </p>
          </div>
          <StatusPill status={period.status === 'open' ? 'active' : period.status === 'closed' ? 'paid' : 'pending'} />
        </div>
      </Card>

      {/* Issues */}
      {issues.length > 0 && (
        <Card padding="md" className="border-[var(--warning)] bg-[var(--warning-bg)]">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={16} className="text-[var(--warning)] mt-0.5 flex-shrink-0" />
            <p className="text-sm font-semibold text-[var(--warning)]">
              {issues.length} {issues.length === 1 ? 'item needs' : 'items need'} attention before submitting
            </p>
          </div>
          <ul className="text-[12px] text-[var(--text-secondary)] space-y-1 ml-6 list-disc">
            {issues.map((i, idx) => (
              <li key={idx}>{i.label}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Worker rows */}
      <div className="space-y-2">
        {records.map((r) => {
          const worker = workers.find((w) => w.profile_id === r.profile_id)
          if (!worker) return null
          const isExp = expanded.has(r.profile_id)
          return (
            <Card key={r.profile_id} padding="none">
              {/* Collapsed row */}
              <button
                type="button"
                onClick={() => toggleExpand(r.profile_id)}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-[var(--bg)] text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[var(--text)] truncate">{worker.full_name}</span>
                    <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] bg-[var(--cream-light)] px-1.5 py-0.5 rounded">
                      {WORKER_TYPE_LABEL[worker.worker_type]}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                    {worker.worker_type === 'contractor_1099'
                      ? '1099 contractor — no withholding'
                      : `${r.total_hours.toFixed(1)} hrs · ${fmtCurrency(r.gross_pay)} gross · ~${fmtCurrency(r.est_net_pay)} est. net`}
                  </p>
                </div>
                <RecordStatusPill status={r.status} />
                {isExp ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
              </button>

              {/* Expanded body */}
              {isExp && (
                <div className="px-4 pb-4 border-t border-[var(--border-light)] pt-3 space-y-4">
                  {worker.worker_type === 'contractor_1099' ? (
                    <ContractorBreakdown record={r} onAddAdjustment={() => setAdjustmentFor(r.profile_id)} />
                  ) : (
                    <W2Breakdown record={r} periodLabel={`${fmtDate(period.period_start)} – ${fmtDate(period.period_end)}`} />
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-light)]">
                    <Button variant="secondary" size="sm" onClick={() => setAdjustmentFor(r.profile_id)}>
                      <Plus size={14} />
                      Add adjustment
                    </Button>
                    {r.status !== 'approved' ? (
                      <Button variant="primary" size="sm" onClick={() => setRecordStatus(r.profile_id, 'approved')}>
                        Approve
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setRecordStatus(r.profile_id, 'calculated')}>
                        Unapprove
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Totals */}
      <Card padding="lg">
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-3">
          Payroll summary — {fmtDate(period.period_start)}–{fmtDate(period.period_end)}, {period.year}
        </p>
        <div className="space-y-1.5 text-sm">
          <Row label="Total gross pay" value={fmtCurrency(totals.gross)} />
          <Row label="Total employee deductions" value={`−${fmtCurrency(totals.deductions)}`} />
          <Row label="Total estimated net pay" value={`~${fmtCurrency(totals.netEst)}`} subtle />
        </div>
        <div className="border-t border-[var(--border-light)] my-3" />
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-2">
          Total cost to business
        </p>
        <div className="space-y-1.5 text-sm">
          <Row label="Employee gross pay" value={fmtCurrency(totals.gross - totals.contractors)} />
          <Row label="Employer benefit costs" value={fmtCurrency(totals.empBenefits)} />
          <Row label="Employer taxes (est.)" value={fmtCurrency(totals.empTaxes)} />
          <Row label="1099 contractor payments" value={fmtCurrency(totals.contractors)} />
        </div>
        <div className="border-t border-[var(--border)] my-3" />
        <Row label="Total employer cost" value={fmtCurrency(totals.totalCost)} bold />

        <div className="text-[11px] text-[var(--text-tertiary)] mt-3 italic">
          All withholding amounts are estimated — Gusto calculates exact figures at submission.
        </div>
      </Card>

      {/* Adjustment slide-over */}
      {adjustmentFor && (
        <AdjustmentSlideOver
          profileId={adjustmentFor}
          onClose={() => setAdjustmentFor(null)}
          onSubmit={handleAddAdjustment}
        />
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-white border-t border-[var(--border)] px-4 py-3 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Button variant="secondary" size="md">
            <Download size={14} />
            Download register
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-secondary)] font-mono">
              {approvedCount} of {records.length} approved
            </span>
            <Button
              variant="primary"
              size="md"
              disabled={!allApproved}
              onClick={() => alert('Would call sync-to-gusto edge function and open Gusto for final review.')}
            >
              <Send size={14} />
              Send to Gusto
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecordStatusPill({ status }: { status: PayrollRecordStatus }) {
  const map: Record<PayrollRecordStatus, { label: string; cls: string }> = {
    calculated: { label: 'Calculated', cls: 'bg-gray-50 text-[var(--text-tertiary)]' },
    reviewed: { label: 'Reviewed', cls: 'bg-blue-50 text-blue-600' },
    approved: { label: 'Approved', cls: 'bg-[var(--success-bg)] text-[var(--success)]' },
    submitted: { label: 'Submitted', cls: 'bg-[var(--warning-bg)] text-[var(--warning)]' },
    paid: { label: 'Paid', cls: 'bg-[var(--success-bg)] text-[var(--success)]' },
  }
  const cfg = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Row({
  label,
  value,
  subtle,
  bold,
}: {
  label: string
  value: string
  subtle?: boolean
  bold?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold text-[var(--text)]' : ''}`}>
      <span className={subtle ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-base text-[var(--navy)]' : ''}`}>{value}</span>
    </div>
  )
}

function W2Breakdown({ record, periodLabel }: { record: PayrollRecord; periodLabel: string }) {
  return (
    <div className="space-y-4 text-[12px]">
      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1">Hours</p>
        <p className="text-[var(--text)] font-mono">
          Regular: {record.regular_hours.toFixed(1)} hrs · OT: {record.overtime_hours.toFixed(1)} hrs · PTO: {record.pto_hours.toFixed(1)} hrs · Total: {record.total_hours.toFixed(1)} hrs
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)] italic mt-0.5">Hours pulled from time clock · {periodLabel}</p>
      </div>

      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Gross pay breakdown</p>
        <div className="space-y-1">
          <BreakdownRow label="Base salary (bi-weekly)" value={fmtCurrency(record.base_pay)} />
          {record.overtime_pay > 0 && <BreakdownRow label="Overtime" value={fmtCurrency(record.overtime_pay)} />}
          {record.vehicle_allowance > 0 && <BreakdownRow label="Vehicle allowance" value={fmtCurrency(record.vehicle_allowance)} />}
          {record.phone_stipend > 0 && <BreakdownRow label="Phone stipend" value={fmtCurrency(record.phone_stipend)} />}
          {record.other_allowances > 0 && <BreakdownRow label="Other allowances" value={fmtCurrency(record.other_allowances)} />}
          {record.bonus_amount > 0 && <BreakdownRow label="Bonus" value={fmtCurrency(record.bonus_amount)} />}
          <Divider />
          <BreakdownRow label="Gross pay" value={fmtCurrency(record.gross_pay)} bold />
        </div>
      </div>

      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Deductions (employee)</p>
        <div className="space-y-1">
          {record.health_deduction > 0 && <BreakdownRow label="Health insurance" value={`−${fmtCurrency(record.health_deduction)}`} />}
          {record.retirement_deduction > 0 && <BreakdownRow label="Retirement (employee)" value={`−${fmtCurrency(record.retirement_deduction)}`} />}
          {record.other_deductions > 0 && <BreakdownRow label="Other deductions" value={`−${fmtCurrency(record.other_deductions)}`} />}
          <Divider />
          <BreakdownRow label="Total deductions" value={`−${fmtCurrency(record.health_deduction + record.retirement_deduction + record.other_deductions)}`} bold />
        </div>
      </div>

      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
          Withholdings (estimated — Gusto calculates exact)
        </p>
        <div className="space-y-1 italic">
          <BreakdownRow label="Federal income tax (est.)" value={`~${fmtCurrency(record.est_federal_withholding)}`} />
          <BreakdownRow label="Ohio income tax (est. 3.5%)" value={`~${fmtCurrency(record.est_state_withholding)}`} />
          <BreakdownRow label="Social Security (est. 6.2%)" value={`~${fmtCurrency(record.est_employee_ss)}`} />
          <BreakdownRow label="Medicare (est. 1.45%)" value={`~${fmtCurrency(record.est_employee_medicare)}`} />
          <Divider />
          <BreakdownRow label="Est. net pay" value={`~${fmtCurrency(record.est_net_pay)}`} bold />
        </div>
      </div>

      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Employer cost</p>
        <div className="space-y-1">
          {record.employer_health_cost > 0 && (
            <BreakdownRow label="Health insurance (employer)" value={fmtCurrency(record.employer_health_cost)} />
          )}
          {record.employer_retirement_cost > 0 && (
            <BreakdownRow label="Retirement match" value={fmtCurrency(record.employer_retirement_cost)} />
          )}
          <BreakdownRow label="Social Security (employer)" value={fmtCurrency(record.employer_ss_tax)} />
          <BreakdownRow label="Medicare (employer)" value={fmtCurrency(record.employer_medicare_tax)} />
          <BreakdownRow label="FUTA / SUTA" value={fmtCurrency(record.employer_futa + record.employer_suta)} />
          <Divider />
          <BreakdownRow label="Total employer cost" value={fmtCurrency(record.total_employer_cost)} bold />
        </div>
      </div>
    </div>
  )
}

function ContractorBreakdown({
  record,
  onAddAdjustment,
}: {
  record: PayrollRecord
  onAddAdjustment: () => void
}) {
  return (
    <div className="space-y-3 text-[12px]">
      <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">
        1099 Contractor — no withholding
      </p>
      <div className="bg-[var(--bg)] rounded-lg p-3">
        <p className="text-[var(--text-secondary)] mb-1">Payment this period</p>
        <p className="font-mono text-xl text-[var(--navy)]">{fmtCurrency(record.contractor_payment)}</p>
        {record.contractor_payment_memo && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">Memo: {record.contractor_payment_memo}</p>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onAddAdjustment}>
        <Plus size={14} />
        Add payment
      </Button>
    </div>
  )
}

function BreakdownRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-[var(--border-light)] my-1" />
}

function AdjustmentSlideOver({
  profileId,
  onClose,
  onSubmit,
}: {
  profileId: string
  onClose: () => void
  onSubmit: (adj: Omit<PayrollAdjustment, 'id' | 'created_at' | 'pay_period_id'>) => void
}) {
  const { data: worker } = useQuery({
    queryKey: ['worker_for_adj', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('id', profileId).single()
      return data as { id: string; full_name: string } | null
    },
  })
  const [type, setType] = useState<PayrollAdjustment['adjustment_type']>('bonus')
  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [taxable, setTaxable] = useState<boolean>(true)

  function handleTypeChange(t: PayrollAdjustment['adjustment_type']) {
    setType(t)
    setTaxable(!(t === 'expense_reimbursement'))
  }

  function handleSubmit() {
    const num = parseFloat(amount)
    if (!num || !description) return
    onSubmit({
      payroll_record_id: null,
      profile_id: profileId,
      adjustment_type: type,
      amount: num,
      is_taxable: taxable,
      description,
      reference_id: null,
      project_id: projectId || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white w-full max-w-md h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-[var(--navy)]">Add adjustment</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">{worker?.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text)]">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as PayrollAdjustment['adjustment_type'])}
              className="w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
            >
              <option value="bonus">Bonus</option>
              <option value="commission">Commission</option>
              <option value="expense_reimbursement">Expense reimbursement (non-taxable)</option>
              <option value="advance">Advance</option>
              <option value="advance_repayment">Advance repayment (deduction)</option>
              <option value="correction">Correction</option>
              <option value="garnishment">Garnishment (deduction)</option>
              <option value="other_addition">Other addition</option>
              <option value="other_deduction">Other deduction</option>
            </select>
          </div>

          <Input
            label="Amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint="Positive number — direction set by type"
          />

          <div className="flex items-center justify-between bg-[var(--bg)] rounded-lg px-3 py-2.5">
            <span className="text-sm text-[var(--text)]">Taxable</span>
            <button
              type="button"
              onClick={() => setTaxable((v) => !v)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${taxable ? 'bg-[var(--navy)] justify-end' : 'bg-gray-300 justify-start'}`}
            >
              <span className="w-5 h-5 rounded-full bg-white block" />
            </button>
          </div>

          <Input
            label="Description"
            placeholder="e.g. Johnson bath project bonus"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text)]">Link to project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
            >
              <option value="">None</option>
              {/* Projects loaded from Supabase separately if needed */}
            </select>
          </div>

          {!taxable && (
            <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--cream-light)] rounded-lg px-3 py-2">
              This will run through payroll for clean record-keeping but will not increase taxable wages.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="md" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" fullWidth onClick={handleSubmit}>
              Add adjustment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
