// Employee paystubs view — employees see their OWN payroll records only.
// Never shows employer cost, employer taxes, or other employees' data.

import { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { PayrollRecord } from '@/data/mock'

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type PayPeriodRow = { id: string; period_start: string; period_end: string; pay_date?: string }
type YTDData = { gross_pay_ytd: number; net_pay_ytd: number; federal_withholding_ytd: number; state_withholding_ytd: number; employee_ss_ytd: number; employee_medicare_ytd: number; year: number }

export function PaystubsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: myRecords = [], error, refetch } = useQuery({
    queryKey: ['my_payroll_records', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('employee_id', user!.id)
        .order('created_at', { ascending: false })
      return (data ?? []) as PayrollRecord[]
    },
  })

  const { data: payPeriods = [] } = useQuery({
    queryKey: ['pay_periods_for_stubs'],
    queryFn: async () => {
      const { data } = await supabase.from('pay_periods').select('id, period_start, period_end, pay_date')
      return (data ?? []) as PayPeriodRow[]
    },
  })

  // Compute YTD from records
  const myYtd: YTDData | null = myRecords.length === 0 ? null : {
    year: new Date().getFullYear(),
    gross_pay_ytd: myRecords.reduce((s, r) => s + (r.gross_pay ?? 0), 0),
    net_pay_ytd: myRecords.reduce((s, r) => s + (r.est_net_pay ?? 0), 0),
    federal_withholding_ytd: myRecords.reduce((s, r) => s + (r.est_federal_withholding ?? 0), 0),
    state_withholding_ytd: myRecords.reduce((s, r) => s + (r.est_state_withholding ?? 0), 0),
    employee_ss_ytd: myRecords.reduce((s, r) => s + (r.est_employee_ss ?? 0), 0),
    employee_medicare_ytd: myRecords.reduce((s, r) => s + (r.est_employee_medicare ?? 0), 0),
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load paystubs. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)]">
          <ArrowLeft size={20} />
        </button>
        <PageHeader title="My paystubs" subtitle="Bi-weekly · Direct deposit via Gusto" />
      </div>

      {myYtd && (
        <Card padding="lg">
          <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-1">
            {myYtd!.year} year-to-date
          </p>
          <p className="font-display text-3xl text-[var(--navy)] font-mono">{fmtCurrency(myYtd.gross_pay_ytd)}</p>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">Gross earnings YTD</p>

          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Net pay</p>
              <p className="font-mono text-[var(--text)]">{fmtCurrency(myYtd.net_pay_ytd)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Federal tax</p>
              <p className="font-mono text-[var(--text)]">{fmtCurrency(myYtd.federal_withholding_ytd)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Ohio tax</p>
              <p className="font-mono text-[var(--text)]">{fmtCurrency(myYtd.state_withholding_ytd)}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">SS + Medicare</p>
              <p className="font-mono text-[var(--text)]">
                {fmtCurrency(myYtd.employee_ss_ytd + myYtd.employee_medicare_ytd)}
              </p>
            </div>
          </div>
        </Card>
      )}

      <p className="uppercase text-[13px] font-semibold tracking-[0.06em] text-[var(--text)] font-body mt-2">
        Recent paystubs
      </p>

      {myRecords.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-[var(--text-tertiary)]">No paystubs available yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {myRecords.map((r) => {
            const period = payPeriods.find((p) => p.id === r.pay_period_id)
            const isOpen = expanded === r.id
            return (
              <Card key={r.id} padding="none">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-[var(--bg)] text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--text)]">
                      {period ? `${fmtDate(period.period_start)} – ${fmtDate(period.period_end)}` : '—'}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                      {r.total_hours.toFixed(1)} hrs · Gross {fmtCurrency(r.gross_pay)} · Net ~{fmtCurrency(r.est_net_pay)}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {isOpen && <PaystubBreakdown record={r} />}
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-[var(--text-tertiary)] italic">
        Withholding amounts shown here are estimates. Your official paystub from Gusto has the exact figures.
      </p>
    </div>
  )
}

function PaystubBreakdown({ record }: { record: PayrollRecord }) {
  return (
    <div className="px-4 pb-4 border-t border-[var(--border-light)] pt-3 space-y-3 text-[12px]">
      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Earnings</p>
        <Row label="Base salary" value={fmtCurrency(record.base_pay)} />
        {record.overtime_pay > 0 && <Row label="Overtime" value={fmtCurrency(record.overtime_pay)} />}
        {record.vehicle_allowance > 0 && <Row label="Vehicle allowance" value={fmtCurrency(record.vehicle_allowance)} />}
        {record.bonus_amount > 0 && <Row label="Bonus" value={fmtCurrency(record.bonus_amount)} />}
        <div className="border-t border-[var(--border-light)] my-1" />
        <Row label="Gross pay" value={fmtCurrency(record.gross_pay)} bold />
      </div>

      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Pre-tax deductions</p>
        {record.health_deduction > 0 && <Row label="Health insurance" value={`−${fmtCurrency(record.health_deduction)}`} />}
        {record.retirement_deduction > 0 && <Row label="Retirement" value={`−${fmtCurrency(record.retirement_deduction)}`} />}
      </div>

      <div>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">Taxes (estimated)</p>
        <Row label="Federal income tax" value={`~${fmtCurrency(record.est_federal_withholding)}`} />
        <Row label="Ohio income tax" value={`~${fmtCurrency(record.est_state_withholding)}`} />
        <Row label="Social Security" value={`~${fmtCurrency(record.est_employee_ss)}`} />
        <Row label="Medicare" value={`~${fmtCurrency(record.est_employee_medicare)}`} />
        <div className="border-t border-[var(--border-light)] my-1" />
        <Row label="Estimated net pay" value={`~${fmtCurrency(record.est_net_pay)}`} bold />
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
