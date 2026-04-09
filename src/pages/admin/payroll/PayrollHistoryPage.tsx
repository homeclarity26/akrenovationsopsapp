import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type PayPeriodRow = { id: string; status: string; period_start: string; period_end: string; pay_date: string; period_number: number; year: number }

export function PayrollHistoryPage() {
  const { data: allPeriods = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pay_periods_all'],
    queryFn: async () => {
      const { data } = await supabase.from('pay_periods').select('*').order('period_number', { ascending: false })
      return (data ?? []) as PayPeriodRow[]
    },
  })

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load payroll history. Check your connection and try again.</p>
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

      <PageHeader title="Payroll history" subtitle="All pay periods" />

      <Card padding="none">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading pay periods…</div>
        ) : allPeriods.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No pay periods found.</div>
        ) : (
          allPeriods.map((p) => (
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
          ))
        )}
      </Card>
    </div>
  )
}
