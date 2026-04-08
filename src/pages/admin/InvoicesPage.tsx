import { useState } from 'react'
import { Plus, Send, Download, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

type Tab = 'all' | 'outstanding' | 'paid'

export function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('all')

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const typedInvoices = invoices as Record<string, unknown>[]

  const filtered = typedInvoices.filter(inv => {
    if (tab === 'outstanding') return ['sent', 'overdue'].includes(inv.status as string)
    if (tab === 'paid') return inv.status === 'paid'
    return true
  })

  const outstanding = typedInvoices
    .filter(i => ['sent', 'overdue'].includes(i.status as string))
    .reduce((s, i) => s + ((i.balance_due as number) ?? 0), 0)
  const paid = typedInvoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + ((i.total as number) ?? 0), 0)

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
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{typedInvoices.filter(i => ['sent','overdue'].includes(i.status as string)).length} invoices</p>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Collected YTD</p>
          <p className="font-display text-2xl text-[var(--success)]">${(paid / 1000).toFixed(1)}K</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{typedInvoices.filter(i => i.status === 'paid').length} invoices</p>
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

      {/* Invoice list */}
      {isLoading ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="font-medium text-sm text-[var(--text)]">No invoices yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Create your first invoice to get started.</p>
        </div>
      ) : (
        <Card padding="none">
          {filtered.map(inv => {
            const invId = String(inv.id ?? '')
            const invTitle = String(inv.title ?? '')
            const invNumber = String(inv.invoice_number ?? '')
            const invTotal = Number(inv.total ?? 0)
            const invBalanceDue = Number(inv.balance_due ?? 0)
            const invStatus = String(inv.status ?? '')
            const invDueDate = inv.due_date ? String(inv.due_date) : ''
            const lineItems = (inv.line_items as { label: string; amount: number }[]) ?? []
            return (
              <div key={invId} className="p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{invTitle}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{invNumber}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold text-[var(--text)]">${invTotal.toLocaleString()}</p>
                    {invBalanceDue > 0 && (
                      <p className="text-xs text-[var(--danger)] font-mono">${invBalanceDue.toLocaleString()} due</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusPill status={invStatus} />
                    {invDueDate && (
                      <span className="text-[11px] text-[var(--text-tertiary)]">
                        Due {invDueDate}
                      </span>
                    )}
                  </div>
                  {['sent', 'overdue'].includes(invStatus) && (
                    <button className="flex items-center gap-1 text-xs text-[var(--rust)] font-semibold">
                      <Send size={12} />
                      Follow Up
                    </button>
                  )}
                </div>

                {/* Line items preview */}
                {lineItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-light)] space-y-1">
                    {lineItems.map((li, i) => (
                      <div key={i} className="flex justify-between">
                        <p className="text-xs text-[var(--text-tertiary)]">{li.label}</p>
                        <p className="text-xs font-mono text-[var(--text-secondary)]">${li.amount.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}

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
                          body: JSON.stringify({ type: 'invoice', id: invId }),
                        })
                        if (res.ok) {
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${invNumber}.pdf`
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
                      const driveUrl = inv.drive_url as string | undefined
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
            )
          })}
        </Card>
      )}
    </div>
  )
}
