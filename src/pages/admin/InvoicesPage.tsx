import { useState } from 'react'
import { Plus, Send, Download, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MOCK_INVOICES, MOCK_TIME_ENTRIES } from '@/data/mock'

type Tab = 'all' | 'outstanding' | 'paid'

export function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [invoices] = useState(MOCK_INVOICES)
  const [selectedBillableTime, setSelectedBillableTime] = useState<Set<string>>(
    new Set(MOCK_TIME_ENTRIES.filter(e => e.is_billable && e.billing_status === 'pending' && e.clock_out !== null).map(e => e.id))
  )

  const filtered = invoices.filter(inv => {
    if (tab === 'outstanding') return ['sent', 'overdue'].includes(inv.status)
    if (tab === 'paid') return inv.status === 'paid'
    return true
  })

  const outstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0)
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'paid', label: 'Paid' },
  ]

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoices`}
        action={
          <Button size="sm">
            <Plus size={15} />
            New Invoice
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Outstanding</p>
          <p className="font-display text-2xl text-[var(--danger)]">${(outstanding / 1000).toFixed(1)}K</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{invoices.filter(i => ['sent','overdue'].includes(i.status)).length} invoices</p>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Collected YTD</p>
          <p className="font-display text-2xl text-[var(--success)]">${(paid / 1000).toFixed(1)}K</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{invoices.filter(i => i.status === 'paid').length} invoices</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--bg)] rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-[var(--text)] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Billable time ready to invoice */}
      {(() => {
        const pendingBillable = MOCK_TIME_ENTRIES.filter(e => e.is_billable && e.billing_status === 'pending' && e.clock_out !== null)
        if (pendingBillable.length === 0) return null
        const USER_NAMES: Record<string, string> = { 'admin-1': 'Adam Kilgore', 'employee-1': 'Jeff Miller', 'employee-2': 'Steven Clark' }
        const WORK_LABELS: Record<string, string> = { field_carpentry: 'Field Carpentry', project_management: 'Project Mgmt', site_visit: 'Site Visit', design: 'Design', administrative: 'Administrative', travel: 'Travel', other: 'Other' }
        const timeTotal = pendingBillable.filter(e => selectedBillableTime.has(e.id)).reduce((sum, e) => sum + (e.billed_amount ?? 0), 0)
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Include billable time</p>
              <p className="font-mono text-sm font-bold text-[var(--success)]">${timeTotal.toFixed(2)}</p>
            </div>
            <div className="border border-[var(--border-light)] rounded-xl overflow-hidden divide-y divide-[var(--border-light)]">
              {pendingBillable.map(e => (
                <label key={e.id} className="flex items-center gap-3 p-3 cursor-pointer bg-white">
                  <input type="checkbox" checked={selectedBillableTime.has(e.id)}
                    onChange={() => setSelectedBillableTime(prev => { const s = new Set(prev); s.has(e.id) ? s.delete(e.id) : s.add(e.id); return s })}
                    className="w-4 h-4 accent-[var(--navy)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{USER_NAMES[e.user_id] ?? e.user_id}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{WORK_LABELS[e.work_type] ?? e.work_type} · {((e.total_minutes ?? 0)/60).toFixed(1)}h @ ${e.billing_rate}/hr</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-[var(--text)] flex-shrink-0">${(e.billed_amount ?? 0).toFixed(2)}</p>
                </label>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Invoice list */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">No invoices</div>
        ) : (
          filtered.map(inv => (
            <div key={inv.id} className="p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{inv.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{inv.invoice_number} · {inv.client_name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-bold text-[var(--text)]">${inv.total.toLocaleString()}</p>
                  {inv.balance_due > 0 && (
                    <p className="text-xs text-[var(--danger)] font-mono">${inv.balance_due.toLocaleString()} due</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusPill status={inv.status} />
                  {inv.due_date && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      Due {inv.due_date}
                    </span>
                  )}
                </div>
                {['sent', 'overdue'].includes(inv.status) && (
                  <button className="flex items-center gap-1 text-xs text-[var(--rust)] font-semibold">
                    <Send size={12} />
                    Follow Up
                  </button>
                )}
              </div>

              {/* Line items preview */}
              <div className="mt-3 pt-3 border-t border-[var(--border-light)] space-y-1">
                {inv.line_items.map((li, i) => (
                  <div key={i} className="flex justify-between">
                    <p className="text-xs text-[var(--text-tertiary)]">{li.label}</p>
                    <p className="text-xs font-mono text-[var(--text-secondary)]">${li.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-3 pt-3 border-t border-[var(--border-light)] flex gap-2">
                <button
                  onClick={async e => {
                    e.stopPropagation()
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
                    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
                    try {
                      const res = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                        body: JSON.stringify({ type: 'invoice', id: inv.id }),
                      })
                      if (res.ok) {
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${inv.invoice_number}.pdf`
                        a.click()
                        URL.revokeObjectURL(url)
                      } else {
                        alert('PDF generation not available yet — edge function not deployed.')
                      }
                    } catch {
                      alert('PDF generation not available yet — edge function not deployed.')
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-[var(--navy)] font-semibold border border-[var(--navy)]/20 bg-[var(--cream-light)] px-3 py-2 rounded-xl min-h-[36px] hover:bg-[var(--cream)] transition-colors"
                >
                  <Download size={12} />
                  Download PDF
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    const driveUrl = (inv as Record<string, unknown>).drive_url as string | undefined
                    if (driveUrl) {
                      window.open(driveUrl, '_blank')
                    } else {
                      alert('Not synced to Drive yet.')
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold border border-[var(--border)] px-3 py-2 rounded-xl min-h-[36px] hover:bg-[var(--bg)] transition-colors"
                >
                  <ExternalLink size={12} />
                  Open in Drive
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
