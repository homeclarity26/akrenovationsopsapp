import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { MOCK_PAYROLL_WORKERS } from '@/data/mock'

const TYPE_LABEL: Record<string, string> = {
  w2_fulltime: 'Full-time',
  w2_parttime: 'Part-time',
  contractor_1099: '1099 Contractor',
  owner: 'Owner',
}

function fmtCurrency(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PayrollWorkersPage() {
  return (
    <div className="px-4 lg:px-8 py-4 space-y-4 max-w-4xl mx-auto">
      <Link
        to="/admin/payroll"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)]"
      >
        <ArrowLeft size={14} />
        Payroll
      </Link>

      <PageHeader
        title="Workers"
        subtitle="Setup, compensation, and benefits"
        action={
          <Link to="/admin/payroll/workers/new">
            <Button variant="primary" size="sm">
              <Plus size={14} />
              New worker
            </Button>
          </Link>
        }
      />

      <Card padding="none">
        {MOCK_PAYROLL_WORKERS.map((w) => (
          <Link
            key={w.profile_id}
            to={`/admin/payroll/workers/${w.profile_id}`}
            className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm text-[var(--text)] truncate">{w.full_name}</span>
                <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] bg-[var(--cream-light)] px-1.5 py-0.5 rounded">
                  {TYPE_LABEL[w.worker_type]}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                {w.pay_type === 'salary' ? `${fmtCurrency(w.annual_salary)}/yr` : `${fmtCurrency(w.hourly_rate)}/hr`}
                {' · '}Hired {new Date(`${w.hire_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
            <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
          </Link>
        ))}
      </Card>
    </div>
  )
}
