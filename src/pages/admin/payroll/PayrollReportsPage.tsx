import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  MOCK_PAYROLL_WORKERS,
  MOCK_PAYROLL_RECORDS,
  MOCK_PAYROLL_YTD,
  MOCK_TIME_ENTRIES,
  MOCK_PROJECTS,
} from '@/data/mock'

type ReportKey = 'labor_by_project' | 'payroll_register' | 'ytd_summary' | 'employer_cost_summary'

const REPORTS: { key: ReportKey; title: string; description: string }[] = [
  {
    key: 'labor_by_project',
    title: 'Labor cost by project',
    description: 'Hours and labor cost (gross + employer taxes) per project for any date range.',
  },
  {
    key: 'payroll_register',
    title: 'Payroll register (full detail)',
    description: 'Every worker, every component, every deduction, every period. Year-end CPA file.',
  },
  {
    key: 'ytd_summary',
    title: 'YTD summary by employee',
    description: 'Current year totals per worker — gross, taxes, net, benefits.',
  },
  {
    key: 'employer_cost_summary',
    title: 'Employer cost summary',
    description: 'Total business cost: wages, taxes, benefits, 1099 payments. Feeds the financial dashboard.',
  },
]

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

export function PayrollReportsPage() {
  const [selected, setSelected] = useState<ReportKey>('ytd_summary')

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-5xl mx-auto">
      <Link
        to="/admin/payroll"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)]"
      >
        <ArrowLeft size={14} />
        Payroll
      </Link>

      <PageHeader
        title="Payroll reports"
        subtitle="Exportable as PDF or CSV. Auto-synced to Google Drive after each run."
      />

      {/* Report selector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setSelected(r.key)}
            className={`text-left rounded-xl border p-4 transition-all ${
              selected === r.key
                ? 'border-[var(--navy)] bg-white shadow-sm'
                : 'border-[var(--border-light)] bg-white hover:border-[var(--border)]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <FileText
                size={18}
                className={selected === r.key ? 'text-[var(--rust)]' : 'text-[var(--text-tertiary)]'}
              />
              <div>
                <p className="font-medium text-sm text-[var(--text)]">{r.title}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{r.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Report preview */}
      <div>
        <SectionHeader
          title="Preview"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                <Download size={14} />
                CSV
              </Button>
              <Button variant="primary" size="sm">
                <Download size={14} />
                PDF
              </Button>
            </div>
          }
        />
        <Card padding="lg">
          {selected === 'labor_by_project' && <LaborByProjectReport />}
          {selected === 'payroll_register' && <PayrollRegisterReport />}
          {selected === 'ytd_summary' && <YTDSummaryReport />}
          {selected === 'employer_cost_summary' && <EmployerCostSummaryReport />}
        </Card>
      </div>

      <p className="text-[11px] text-[var(--text-tertiary)] italic">
        All withholding amounts are estimated — Gusto calculates exact figures during payroll submission.
      </p>
    </div>
  )
}

function LaborByProjectReport() {
  const data = useMemo(() => {
    const byProject: Record<string, { project_id: string; project_title: string; minutes: number; cost: number }> = {}
    for (const t of MOCK_TIME_ENTRIES) {
      if (!t.total_minutes || !t.project_id) continue
      const key = t.project_id
      const proj = MOCK_PROJECTS.find((p) => p.id === t.project_id)
      if (!byProject[key]) {
        byProject[key] = {
          project_id: key,
          project_title: proj?.title ?? t.project_title ?? 'Unknown',
          minutes: 0,
          cost: 0,
        }
      }
      byProject[key].minutes += t.total_minutes
      const billing = (t.billing_rate ?? 0)
      byProject[key].cost += (t.total_minutes / 60) * billing * 0.6 // labor cost ~ 60% of bill rate
    }
    return Object.values(byProject)
  }, [])

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] pb-2 border-b border-[var(--border-light)]">
        <div className="col-span-7">Project</div>
        <div className="col-span-2 text-right">Hours</div>
        <div className="col-span-3 text-right">Labor cost</div>
      </div>
      {data.map((row) => (
        <div key={row.project_id} className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-[var(--border-light)]">
          <div className="col-span-7 truncate">{row.project_title}</div>
          <div className="col-span-2 text-right font-mono">{(row.minutes / 60).toFixed(1)}</div>
          <div className="col-span-3 text-right font-mono">{fmtCurrency(row.cost)}</div>
        </div>
      ))}
    </div>
  )
}

function PayrollRegisterReport() {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] pb-2 border-b border-[var(--border-light)]">
        <div className="col-span-3">Worker</div>
        <div className="col-span-2 text-right">Hours</div>
        <div className="col-span-2 text-right">Gross</div>
        <div className="col-span-2 text-right">Deductions</div>
        <div className="col-span-3 text-right">Est. net</div>
      </div>
      {MOCK_PAYROLL_RECORDS.map((r) => {
        const w = MOCK_PAYROLL_WORKERS.find((x) => x.profile_id === r.profile_id)
        return (
          <div
            key={r.id}
            className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-[var(--border-light)]"
          >
            <div className="col-span-3 truncate">{w?.full_name}</div>
            <div className="col-span-2 text-right font-mono">{r.total_hours.toFixed(1)}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(r.gross_pay)}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(r.total_deductions)}</div>
            <div className="col-span-3 text-right font-mono">~{fmtCurrency(r.est_net_pay)}</div>
          </div>
        )
      })}
    </div>
  )
}

function YTDSummaryReport() {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] pb-2 border-b border-[var(--border-light)]">
        <div className="col-span-3">Worker</div>
        <div className="col-span-2 text-right">Gross</div>
        <div className="col-span-2 text-right">Federal</div>
        <div className="col-span-2 text-right">State</div>
        <div className="col-span-3 text-right">Net</div>
      </div>
      {MOCK_PAYROLL_YTD.map((y) => {
        const w = MOCK_PAYROLL_WORKERS.find((x) => x.profile_id === y.profile_id)
        return (
          <div
            key={y.profile_id}
            className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-[var(--border-light)]"
          >
            <div className="col-span-3 truncate">{w?.full_name}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(y.gross_pay_ytd)}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(y.federal_withholding_ytd)}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(y.state_withholding_ytd)}</div>
            <div className="col-span-3 text-right font-mono">{fmtCurrency(y.net_pay_ytd)}</div>
          </div>
        )
      })}
    </div>
  )
}

function EmployerCostSummaryReport() {
  const totals = useMemo(() => {
    return MOCK_PAYROLL_RECORDS.reduce(
      (acc, r) => {
        acc.wages += r.gross_pay - r.contractor_payment
        acc.benefits += r.employer_health_cost + r.employer_retirement_cost
        acc.taxes += r.employer_ss_tax + r.employer_medicare_tax + r.employer_futa + r.employer_suta
        acc.contractors += r.contractor_payment
        acc.total += r.total_employer_cost
        return acc
      },
      { wages: 0, benefits: 0, taxes: 0, contractors: 0, total: 0 },
    )
  }, [])

  return (
    <div className="space-y-2">
      <Row label="Employee gross pay" value={fmtCurrency(totals.wages)} />
      <Row label="Employer benefit costs" value={fmtCurrency(totals.benefits)} />
      <Row label="Employer taxes (est.)" value={fmtCurrency(totals.taxes)} />
      <Row label="1099 contractor payments" value={fmtCurrency(totals.contractors)} />
      <div className="border-t border-[var(--border)] pt-2 mt-2">
        <Row label="Total employer cost" value={fmtCurrency(totals.total)} bold />
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-semibold text-[var(--navy)]' : ''}`}>
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
