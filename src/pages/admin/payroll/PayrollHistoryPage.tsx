import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { MOCK_PAY_PERIODS, MOCK_PAYROLL_WORKERS } from '@/data/mock'

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PayrollHistoryPage() {
  const allPeriods = [...MOCK_PAY_PERIODS].sort((a, b) => b.period_number - a.period_number)
  const estimatedTotal = MOCK_PAYROLL_WORKERS.filter((w) => w.worker_type !== 'contractor_1099').reduce(
    (s, w) => s + ((w.annual_salary ?? 0) / 26 + 138.46),
    0,
  )

  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-4xl mx-auto">
      <Link
        to="/admin/payroll"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)]"
      >
        <ArrowLeft size={14} />
        Payroll
      </Link>

      <PageHeader title="Payroll history" subtitle="All 26 pay periods for 2026" />

      <Card padding="none">
        {allPeriods.map((p) => (
          <Link
            key={p.id}
            to={`/admin/payroll/${p.id}`}
            className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm text-[var(--text)]">
                  Period {p.period_number} · {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">Pay date: {fmtDate(p.pay_date)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-[var(--text-secondary)]">
                {p.status === 'closed' ? fmtCurrency(estimatedTotal) : '—'}
              </span>
              <StatusPill
                status={
                  p.status === 'closed'
                    ? 'paid'
                    : p.status === 'open'
                      ? 'active'
                      : p.status === 'submitted'
                        ? 'sent'
                        : 'pending'
                }
              />
              <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
            </div>
          </Link>
        ))}
      </Card>
    </div>
  )
}
