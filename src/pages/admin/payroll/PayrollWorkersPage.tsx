import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

type WorkerProfile = { id: string; full_name: string; role: string; email?: string; start_date?: string; hourly_rate?: number; base_salary?: number }

export function PayrollWorkersPage() {
  const { data: workers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['payroll_worker_profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, email, start_date, hourly_rate, base_salary')
        .in('role', ['employee', 'admin'])
        .eq('is_active', true)
        .order('full_name')
      return (data ?? []) as WorkerProfile[]
    },
  })

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load workers. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

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
        {isLoading ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading workers…</div>
        ) : workers.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No workers found.</div>
        ) : (
          workers.map((w) => (
            <Link
              key={w.id}
              to={`/admin/payroll/workers/${w.id}`}
              className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm text-[var(--text)] truncate">{w.full_name}</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] bg-[var(--cream-light)] px-1.5 py-0.5 rounded">
                    {TYPE_LABEL[w.role] ?? w.role}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                  {w.base_salary ? `${fmtCurrency(w.base_salary)}/yr` : w.hourly_rate ? `${fmtCurrency(w.hourly_rate)}/hr` : '—'}
                  {w.start_date && ` · Hired ${new Date(`${w.start_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
            </Link>
          ))
        )}
      </Card>
    </div>
  )
}
