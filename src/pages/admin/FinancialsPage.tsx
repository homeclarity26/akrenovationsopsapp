import { useQuery } from '@tanstack/react-query'
import { MetricCard } from '@/components/ui/Card'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

export function FinancialsPage() {
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })
      return data ?? []
    },
  })

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const typedInvoices = invoices as Record<string, unknown>[]
  const typedExpenses = expenses as Record<string, unknown>[]
  const typedProjects = projects as Record<string, unknown>[]

  const revenue_ytd = typedInvoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + ((i.total as number) ?? 0), 0)

  const expenses_ytd = typedExpenses.reduce((s, e) => s + ((e.amount as number) ?? 0), 0)
  const profit_ytd = revenue_ytd - expenses_ytd
  const outstanding_ar = typedInvoices
    .filter(i => ['sent', 'overdue'].includes(i.status as string))
    .reduce((s, i) => s + ((i.balance_due as number) ?? 0), 0)

  const profit_margin = revenue_ytd > 0 ? profit_ytd / revenue_ytd : 0
  const maxValue = Math.max(revenue_ytd, 1)

  const projectsWithMargin = typedProjects.filter(p => p.actual_margin != null)

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Financials" subtitle="YTD through April 2026" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Revenue YTD" value={`$${(revenue_ytd / 1000).toFixed(1)}K`} subtitle="Total billed" />
        <MetricCard label="Expenses YTD" value={`$${(expenses_ytd / 1000).toFixed(1)}K`} subtitle="Materials + labor" />
        <MetricCard label="Profit YTD" value={`$${(profit_ytd / 1000).toFixed(1)}K`} subtitle={`${(profit_margin * 100).toFixed(1)}% margin`} />
        <MetricCard label="Outstanding AR" value={`$${(outstanding_ar / 1000).toFixed(1)}K`} subtitle={`${typedInvoices.filter(i => ['sent','overdue'].includes(i.status as string)).length} invoices`} />
      </div>

      {/* P&L Bar */}
      <Card>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-3">
          Profit & Loss
        </p>
        <div className="space-y-4">
          {[
            { label: 'Revenue',  value: revenue_ytd,  color: 'bg-[var(--navy)]',    max: maxValue },
            { label: 'Expenses', value: expenses_ytd, color: 'bg-[var(--rust)]',    max: maxValue },
            { label: 'Profit',   value: profit_ytd,   color: 'bg-[var(--success)]', max: maxValue },
          ].map(row => (
            <div key={row.label}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-xs font-medium text-[var(--text-secondary)] w-16 flex-shrink-0">{row.label}</span>
                <div className="flex-1 border-b border-dashed border-[var(--border-light)]" />
                <span className="font-mono text-sm font-semibold text-[var(--text)] flex-shrink-0">
                  ${row.value.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden ml-18">
                <div
                  className={`h-full ${row.color} rounded-full`}
                  style={{ width: `${Math.max(0, (row.value / row.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Invoices */}
      <div>
        <SectionHeader title="Accounts Receivable" />
        {invoicesLoading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
          </div>
        ) : typedInvoices.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="font-medium text-sm text-[var(--text)]">No invoices yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Invoices will appear here once created.</p>
          </div>
        ) : (
          <Card padding="none">
            {typedInvoices.map(inv => (
              <div key={inv.id as string} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{inv.invoice_number as string}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{inv.title as string}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusPill status={inv.status as string} />
                  <span className="font-mono text-sm font-semibold text-[var(--text)]">
                    ${((inv.balance_due as number) > 0 ? inv.balance_due as number : inv.total as number).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Project Margins */}
      <div>
        <SectionHeader title="Project Margins" />
        {projectsLoading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
          </div>
        ) : projectsWithMargin.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="font-medium text-sm text-[var(--text)]">No margin data yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Project margins will appear here as projects progress.</p>
          </div>
        ) : (
          <Card padding="none">
            {projectsWithMargin.map(p => (
              <div key={p.id as string} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{p.title as string}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Target: {((p.target_margin as number) * 100).toFixed(0)}%</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-mono text-sm font-semibold ${(p.actual_margin as number) >= (p.target_margin as number) ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {((p.actual_margin as number) * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {(p.actual_margin as number) >= (p.target_margin as number) ? 'On target' : 'Below target'}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
