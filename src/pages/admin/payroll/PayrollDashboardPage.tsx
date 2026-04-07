import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Users, AlertCircle, ArrowRight, Plus, FileText } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import {
  MOCK_PAY_PERIODS,
  MOCK_PAYROLL_RECORDS,
  MOCK_PAYROLL_WORKERS,
  MOCK_PAYROLL_YTD,
  MOCK_PAST_PAYROLL_RUNS,
  MOCK_TIME_ENTRIES,
} from '@/data/mock'

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(dateStr: string): number {
  const today = new Date('2026-04-07')
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function PayrollDashboardPage() {
  const upcomingPeriod = useMemo(
    () => MOCK_PAY_PERIODS.find((p) => p.status === 'open' || p.status === 'upcoming') ?? MOCK_PAY_PERIODS[0],
    [],
  )

  const estimatedTotal = useMemo(
    () => MOCK_PAYROLL_RECORDS.reduce((s, r) => s + r.gross_pay, 0),
    [],
  )

  const ytdLaborCost = useMemo(
    () => MOCK_PAYROLL_YTD.reduce((s, y) => s + y.gross_pay_ytd, 0),
    [],
  )

  const pendingApprovals = useMemo(
    () =>
      MOCK_TIME_ENTRIES.filter(
        (t) => t.entry_method === 'manual' && !('approved_by' in t ? t.approved_by : null),
      ).length,
    [],
  )

  const daysAway = daysBetween(upcomingPeriod.pay_date)
  const workersWithHours = MOCK_PAYROLL_RECORDS.filter((r) => r.total_hours > 0 || r.contractor_payment > 0).length
  const totalWorkers = MOCK_PAYROLL_WORKERS.length
  const adjustmentsCount = MOCK_PAYROLL_RECORDS.filter((r) => r.bonus_amount > 0).length

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="Payroll"
        subtitle="Bi-weekly · Every other Friday · Powered by Gusto"
        action={
          <Link to={`/admin/payroll/${upcomingPeriod.id}`}>
            <Button variant="primary" size="sm">
              Review payroll
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />

      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Next payroll"
          value={fmtDate(upcomingPeriod.pay_date)}
          subtitle={daysAway >= 0 ? `${daysAway} days away` : `${Math.abs(daysAway)} days ago`}
        />
        <Card padding="md">
          <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-1">
            Est. next total
          </p>
          <p className="font-display text-2xl text-[var(--text)] leading-tight font-mono">
            {fmtCurrency(estimatedTotal)}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Gross — Gusto calc exact</p>
        </Card>
        <Card padding="md">
          <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-1">
            YTD labor cost
          </p>
          <p className="font-display text-2xl text-[var(--text)] leading-tight font-mono">
            {fmtCurrency(ytdLaborCost)}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">All employer cost</p>
        </Card>
        <MetricCard
          label="Pending approvals"
          value={pendingApprovals}
          subtitle="Manual time entries"
        />
      </div>

      {/* Current period card */}
      <Card padding="lg">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-1">
              Current pay period
            </p>
            <p className="font-display text-xl text-[var(--text)]">
              {fmtDate(upcomingPeriod.period_start)} – {fmtDate(upcomingPeriod.period_end)}, {upcomingPeriod.year}
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 font-mono">
              Pay date: {fmtDate(upcomingPeriod.pay_date)}
            </p>
          </div>
          <StatusPill status={upcomingPeriod.status === 'open' ? 'active' : 'pending'} />
        </div>

        <div className="space-y-2 mt-4">
          <ProgressRow
            label="Time entries collected"
            value={`${workersWithHours} of ${totalWorkers} workers`}
            done={workersWithHours === totalWorkers}
          />
          <ProgressRow
            label="Manual entries pending approval"
            value={pendingApprovals === 0 ? 'All approved' : `${pendingApprovals} pending`}
            done={pendingApprovals === 0}
          />
          <ProgressRow
            label="Adjustments / bonuses"
            value={adjustmentsCount === 0 ? 'None added' : `${adjustmentsCount} added`}
            done
          />
        </div>

        <div className="flex gap-2 mt-5">
          <Link to={`/admin/payroll/${upcomingPeriod.id}`} className="flex-1">
            <Button variant="primary" fullWidth size="md">
              Review payroll
            </Button>
          </Link>
          <Link to={`/admin/payroll/${upcomingPeriod.id}?addAdj=1`} className="flex-1">
            <Button variant="secondary" fullWidth size="md">
              <Plus size={14} />
              Add adjustment
            </Button>
          </Link>
        </div>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Link to="/admin/payroll/workers">
          <Card padding="md" className="hover:shadow-sm transition-shadow">
            <Users size={18} className="text-[var(--navy)] mb-2" />
            <p className="font-medium text-sm text-[var(--text)]">Workers</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Setup, comp, benefits</p>
          </Card>
        </Link>
        <Link to="/admin/payroll/reports">
          <Card padding="md" className="hover:shadow-sm transition-shadow">
            <FileText size={18} className="text-[var(--navy)] mb-2" />
            <p className="font-medium text-sm text-[var(--text)]">Reports</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Labor, register, YTD</p>
          </Card>
        </Link>
        <Link to="/admin/payroll/history">
          <Card padding="md" className="hover:shadow-sm transition-shadow">
            <Calendar size={18} className="text-[var(--navy)] mb-2" />
            <p className="font-medium text-sm text-[var(--text)]">History</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Past payroll runs</p>
          </Card>
        </Link>
      </div>

      {/* Recent payroll history */}
      <div>
        <SectionHeader title="Recent payroll history" />
        <Card padding="none">
          {MOCK_PAST_PAYROLL_RUNS.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              No past payroll runs yet
            </div>
          ) : (
            MOCK_PAST_PAYROLL_RUNS.map(({ period, total_paid }) => (
              <Link
                key={period.id}
                to={`/admin/payroll/${period.id}`}
                className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)] transition-colors"
              >
                <div>
                  <p className="font-medium text-sm text-[var(--text)]">
                    {fmtDate(period.period_start)} – {fmtDate(period.period_end)}, {period.year}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                    Paid {fmtDate(period.pay_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-[var(--text)]">{fmtCurrency(total_paid)}</span>
                  <StatusPill status="paid" />
                </div>
              </Link>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

function ProgressRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span
        className={`font-medium flex items-center gap-1.5 ${
          done ? 'text-[var(--success)]' : 'text-[var(--warning)]'
        }`}
      >
        {!done && <AlertCircle size={13} />}
        {value}
      </span>
    </div>
  )
}
