import { MetricCard } from '@/components/ui/Card'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { MOCK_FINANCIALS, MOCK_INVOICES, MOCK_PROJECTS } from '@/data/mock'

export function FinancialsPage() {
  const profit_margin = MOCK_FINANCIALS.profit_ytd / MOCK_FINANCIALS.revenue_ytd

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Financials" subtitle="YTD through April 2026" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Revenue YTD" value={`$${(MOCK_FINANCIALS.revenue_ytd / 1000).toFixed(1)}K`} subtitle="Total billed" />
        <MetricCard label="Expenses YTD" value={`$${(MOCK_FINANCIALS.expenses_ytd / 1000).toFixed(1)}K`} subtitle="Materials + labor" />
        <MetricCard label="Profit YTD" value={`$${(MOCK_FINANCIALS.profit_ytd / 1000).toFixed(1)}K`} subtitle={`${(profit_margin * 100).toFixed(1)}% margin`} />
        <MetricCard label="Outstanding AR" value={`$${(MOCK_FINANCIALS.outstanding_ar / 1000).toFixed(1)}K`} subtitle="2 invoices" />
      </div>

      {/* P&L Bar */}
      <Card>
        <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-3">
          Profit & Loss
        </p>
        <div className="space-y-4">
          {[
            { label: 'Revenue',  value: MOCK_FINANCIALS.revenue_ytd,  color: 'bg-[var(--navy)]',    max: MOCK_FINANCIALS.revenue_ytd },
            { label: 'Expenses', value: MOCK_FINANCIALS.expenses_ytd, color: 'bg-[var(--rust)]',    max: MOCK_FINANCIALS.revenue_ytd },
            { label: 'Profit',   value: MOCK_FINANCIALS.profit_ytd,   color: 'bg-[var(--success)]', max: MOCK_FINANCIALS.revenue_ytd },
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
                  style={{ width: `${(row.value / row.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Invoices */}
      <div>
        <SectionHeader title="Accounts Receivable" />
        <Card padding="none">
          {MOCK_INVOICES.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--text)]">{inv.invoice_number}</p>
                <p className="text-xs text-[var(--text-secondary)]">{inv.title}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusPill status={inv.status} />
                <span className="font-mono text-sm font-semibold text-[var(--text)]">
                  ${inv.balance_due > 0 ? inv.balance_due.toLocaleString() : inv.total.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Project Margins */}
      <div>
        <SectionHeader title="Project Margins" />
        <Card padding="none">
          {MOCK_PROJECTS.filter(p => p.actual_margin).map(p => (
            <div key={p.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--text)] truncate">{p.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">Target: {(p.target_margin * 100).toFixed(0)}%</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-mono text-sm font-semibold ${p.actual_margin! >= p.target_margin ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {(p.actual_margin! * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  {p.actual_margin! >= p.target_margin ? 'On target' : 'Below target'}
                </p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
