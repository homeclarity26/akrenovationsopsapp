import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

type PayrollRecordRow = { id: string; employee_id?: string; profile_id?: string; pay_period_id: string; gross_pay: number; total_hours: number; total_deductions: number; est_net_pay: number; contractor_payment: number; employer_health_cost: number; employer_retirement_cost: number; employer_ss_tax: number; employer_medicare_tax: number; employer_futa: number; employer_suta: number; total_employer_cost: number; est_federal_withholding: number; est_state_withholding: number; bonus_amount: number }
type WorkerRow = { id: string; full_name: string }
type TimeEntryRow = { id: string; project_id?: string; total_hours?: number; is_billable?: boolean }
type ProjectRow = { id: string; title: string }

export function PayrollReportsPage() {
  const [selected, setSelected] = useState<ReportKey>('ytd_summary')

  const { data: payrollRecords = [] } = useQuery({
    queryKey: ['all_payroll_records'],
    queryFn: async () => {
      const { data } = await supabase.from('payroll_records').select('*')
      return (data ?? []) as PayrollRecordRow[]
    },
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['worker_profiles_report'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['employee', 'admin'])
      return (data ?? []) as WorkerRow[]
    },
  })

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['all_time_entries'],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('id, project_id, total_hours, is_billable').not('clock_out', 'is', null)
      return (data ?? []) as TimeEntryRow[]
    },
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, title')
      return (data ?? []) as ProjectRow[]
    },
  })

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
          {selected === 'labor_by_project' && <LaborByProjectReport timeEntries={timeEntries} projects={projects} />}
          {selected === 'payroll_register' && <PayrollRegisterReport records={payrollRecords} workers={workers} />}
          {selected === 'ytd_summary' && <YTDSummaryReport records={payrollRecords} workers={workers} />}
          {selected === 'employer_cost_summary' && <EmployerCostSummaryReport records={payrollRecords} />}
        </Card>
      </div>

      <p className="text-[11px] text-[var(--text-tertiary)] italic">
        All withholding amounts are estimated — Gusto calculates exact figures during payroll submission.
      </p>
    </div>
  )
}

function LaborByProjectReport({ timeEntries, projects }: { timeEntries: TimeEntryRow[]; projects: ProjectRow[] }) {
  const data = useMemo(() => {
    const byProject: Record<string, { project_id: string; project_title: string; hours: number }> = {}
    for (const t of timeEntries) {
      if (!t.project_id) continue
      const key = t.project_id
      const proj = projects.find((p) => p.id === key)
      if (!byProject[key]) {
        byProject[key] = { project_id: key, project_title: proj?.title ?? 'Unknown', hours: 0 }
      }
      byProject[key].hours += t.total_hours ?? 0
    }
    return Object.values(byProject)
  }, [timeEntries, projects])

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] pb-2 border-b border-[var(--border-light)]">
        <div className="col-span-7">Project</div>
        <div className="col-span-2 text-right">Hours</div>
        <div className="col-span-3 text-right">Labor cost</div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-[var(--text-tertiary)] py-4 text-center">No labor data yet</div>
      ) : data.map((row) => (
        <div key={row.project_id} className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-[var(--border-light)]">
          <div className="col-span-7 truncate">{row.project_title}</div>
          <div className="col-span-2 text-right font-mono">{row.hours.toFixed(1)}</div>
          <div className="col-span-3 text-right font-mono">—</div>
        </div>
      ))}
    </div>
  )
}

function PayrollRegisterReport({ records, workers }: { records: PayrollRecordRow[]; workers: WorkerRow[] }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] pb-2 border-b border-[var(--border-light)]">
        <div className="col-span-3">Worker</div>
        <div className="col-span-2 text-right">Hours</div>
        <div className="col-span-2 text-right">Gross</div>
        <div className="col-span-2 text-right">Deductions</div>
        <div className="col-span-3 text-right">Est. net</div>
      </div>
      {records.length === 0 ? (
        <div className="text-sm text-[var(--text-tertiary)] py-4 text-center">No payroll records yet</div>
      ) : records.map((r) => {
        const profileId = r.employee_id ?? r.profile_id
        const w = workers.find((x) => x.id === profileId)
        return (
          <div
            key={r.id}
            className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-[var(--border-light)]"
          >
            <div className="col-span-3 truncate">{w?.full_name ?? '—'}</div>
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

function YTDSummaryReport({ records, workers }: { records: PayrollRecordRow[]; workers: WorkerRow[] }) {
  const ytdByWorker = useMemo(() => {
    const map: Record<string, { id: string; gross: number; federal: number; state: number; net: number }> = {}
    for (const r of records) {
      const profileId = r.employee_id ?? r.profile_id ?? ''
      if (!map[profileId]) map[profileId] = { id: profileId, gross: 0, federal: 0, state: 0, net: 0 }
      map[profileId].gross += r.gross_pay ?? 0
      map[profileId].federal += r.est_federal_withholding ?? 0
      map[profileId].state += r.est_state_withholding ?? 0
      map[profileId].net += r.est_net_pay ?? 0
    }
    return Object.values(map)
  }, [records])

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] pb-2 border-b border-[var(--border-light)]">
        <div className="col-span-3">Worker</div>
        <div className="col-span-2 text-right">Gross</div>
        <div className="col-span-2 text-right">Federal</div>
        <div className="col-span-2 text-right">State</div>
        <div className="col-span-3 text-right">Net</div>
      </div>
      {ytdByWorker.length === 0 ? (
        <div className="text-sm text-[var(--text-tertiary)] py-4 text-center">No YTD data yet</div>
      ) : ytdByWorker.map((y) => {
        const w = workers.find((x) => x.id === y.id)
        return (
          <div
            key={y.id}
            className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-[var(--border-light)]"
          >
            <div className="col-span-3 truncate">{w?.full_name ?? '—'}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(y.gross)}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(y.federal)}</div>
            <div className="col-span-2 text-right font-mono">{fmtCurrency(y.state)}</div>
            <div className="col-span-3 text-right font-mono">{fmtCurrency(y.net)}</div>
          </div>
        )
      })}
    </div>
  )
}

function EmployerCostSummaryReport({ records }: { records: PayrollRecordRow[] }) {
  const totals = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        acc.wages += (r.gross_pay ?? 0) - (r.contractor_payment ?? 0)
        acc.benefits += (r.employer_health_cost ?? 0) + (r.employer_retirement_cost ?? 0)
        acc.taxes += (r.employer_ss_tax ?? 0) + (r.employer_medicare_tax ?? 0) + (r.employer_futa ?? 0) + (r.employer_suta ?? 0)
        acc.contractors += r.contractor_payment ?? 0
        acc.total += r.total_employer_cost ?? 0
        return acc
      },
      { wages: 0, benefits: 0, taxes: 0, contractors: 0, total: 0 },
    )
  }, [records])

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
