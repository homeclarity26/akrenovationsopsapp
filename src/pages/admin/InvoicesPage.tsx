import { useState } from 'react'
import { Plus, Send, Download, ExternalLink, X, CheckCircle2, DollarSign } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

type Tab = 'all' | 'outstanding' | 'paid'

interface LineItem {
  label: string
  amount: number
}

interface NewInvoiceForm {
  project_id: string
  title: string
  due_date: string
  line_items: LineItem[]
}

interface MarkPaidForm {
  amount: string
  method: string
  date: string
}

function generateInvoiceNumber(): string {
  const y = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `INV-${y}-${rand}`
}

export function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewInvoiceForm>({
    project_id: '',
    title: '',
    due_date: '',
    line_items: [{ label: '', amount: 0 }],
  })
  const [paidForm, setPaidForm] = useState<MarkPaidForm>({ amount: '', method: 'check', date: new Date().toISOString().slice(0, 10) })
  const queryClient = useQueryClient()

  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects-invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, client_name')
        .eq('status', 'active')
        .order('title')
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

  // ── Create invoice ─────────────────────────────────────────────────────────

  const lineTotal = form.line_items.reduce((s, li) => s + (Number(li.amount) || 0), 0)

  async function handleCreateInvoice() {
    if (!form.project_id || !form.title || form.line_items.every(li => !li.label)) return
    setSaving(true)
    try {
      const items = form.line_items.filter(li => li.label.trim())
      const subtotal = items.reduce((s, li) => s + (Number(li.amount) || 0), 0)
      const { error } = await supabase.from('invoices').insert({
        project_id: form.project_id,
        invoice_number: generateInvoiceNumber(),
        title: form.title,
        line_items: items,
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total: subtotal,
        balance_due: subtotal,
        status: 'draft',
        due_date: form.due_date || null,
        payment_mode: 'single',
      })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowCreate(false)
      setForm({ project_id: '', title: '', due_date: '', line_items: [{ label: '', amount: 0 }] })
    } finally {
      setSaving(false)
    }
  }

  // ── Send invoice ───────────────────────────────────────────────────────────

  async function handleSend(invId: string, invNumber: string) {
    const now = new Date().toISOString()
    // Optimistic
    queryClient.setQueryData(['invoices'], (old: Record<string, unknown>[] = []) =>
      old.map(i => (i.id as string) === invId ? { ...i, status: 'sent', sent_at: now } : i)
    )
    // Try PDF gen (non-blocking)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ type: 'invoice', id: invId }),
    }).catch(() => {})
    // DB update
    await supabase.from('invoices').update({ status: 'sent', sent_at: now }).eq('id', invId)
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    void invNumber
  }

  // ── Mark paid ──────────────────────────────────────────────────────────────

  async function handleMarkPaid() {
    if (!markPaidInvoice) return
    setSaving(true)
    try {
      const invId = markPaidInvoice.id as string
      const amount = parseFloat(paidForm.amount) || (markPaidInvoice.balance_due as number) || (markPaidInvoice.total as number)
      await supabase.from('invoices').update({
        status: 'paid',
        paid_at: new Date(`${paidForm.date}T12:00:00`).toISOString(),
        paid_amount: amount,
        payment_method: paidForm.method,
        balance_due: 0,
      }).eq('id', invId)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setMarkPaidInvoice(null)
      setPaidForm({ amount: '', method: 'check', date: new Date().toISOString().slice(0, 10) })
    } finally {
      setSaving(false)
    }
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load invoices. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoices`}
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
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
                ? 'bg-white text-[var(--navy)] shadow-sm'
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
              <div key={invId} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{invTitle}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{invNumber}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold text-[var(--text)]">${invTotal.toLocaleString()}</p>
                    {invBalanceDue > 0 && invStatus !== 'paid' && (
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
                <div className="mt-3 pt-3 border-t border-[var(--border-light)] flex flex-wrap gap-2">
                  {/* Draft: Send */}
                  {invStatus === 'draft' && (
                    <button
                      onClick={() => handleSend(invId, invNumber)}
                      className="flex items-center gap-1.5 text-xs text-white font-semibold bg-[var(--navy)] px-3 py-2 rounded-xl min-h-[36px] hover:bg-[var(--navy-light)] transition-colors"
                    >
                      <Send size={12} />
                      Send
                    </button>
                  )}
                  {/* Sent/Overdue: Mark Paid */}
                  {['sent', 'overdue'].includes(invStatus) && (
                    <button
                      onClick={() => {
                        setPaidForm({ amount: String(invBalanceDue), method: 'check', date: new Date().toISOString().slice(0, 10) })
                        setMarkPaidInvoice(inv)
                      }}
                      className="flex items-center gap-1.5 text-xs text-white font-semibold bg-[var(--success)] px-3 py-2 rounded-xl min-h-[36px] hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle2 size={12} />
                      Mark Paid
                    </button>
                  )}
                  {/* Download PDF */}
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
                          alert('PDF generation not available yet.')
                        }
                      } catch {
                        alert('PDF generation not available yet.')
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-[var(--navy)] font-semibold border border-[var(--navy)]/20 bg-[var(--cream-light)] px-3 py-2 rounded-xl min-h-[36px] hover:bg-[var(--cream)] transition-colors"
                  >
                    <Download size={12} />
                    PDF
                  </button>
                  {!!inv.drive_url && (
                    <button
                      onClick={() => window.open(inv.drive_url as string, '_blank')}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold border border-[var(--border)] px-3 py-2 rounded-xl min-h-[36px] hover:bg-[var(--bg)] transition-colors"
                    >
                      <ExternalLink size={12} />
                      Drive
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {/* ── New Invoice Sheet ────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowCreate(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl p-5 space-y-4 max-h-[90svh] overflow-y-auto pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-[var(--navy)]">New Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl text-[var(--text-secondary)]">
                <X size={20} />
              </button>
            </div>

            {/* Project */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Project</label>
              <select
                value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] text-[var(--text)] min-h-[44px]"
              >
                <option value="">Select a project...</option>
                {(activeProjects as { id: string; title: string; client_name: string }[]).map(p => (
                  <option key={p.id} value={p.id}>{p.title} — {p.client_name}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Invoice Title</label>
              <input
                type="text"
                placeholder="e.g. Final Payment — Thompson Renovation"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
              />
            </div>

            {/* Due date */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
              />
            </div>

            {/* Line items */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Line Items</label>
              <div className="space-y-2">
                {form.line_items.map((li, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Description"
                      value={li.label}
                      onChange={e => setForm(f => ({
                        ...f,
                        line_items: f.line_items.map((item, i) => i === idx ? { ...item, label: e.target.value } : item),
                      }))}
                      className="flex-1 border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--bg)] min-h-[44px]"
                    />
                    <input
                      type="number"
                      placeholder="$0"
                      value={li.amount || ''}
                      onChange={e => setForm(f => ({
                        ...f,
                        line_items: f.line_items.map((item, i) => i === idx ? { ...item, amount: parseFloat(e.target.value) || 0 } : item),
                      }))}
                      className="w-24 border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--bg)] font-mono min-h-[44px]"
                    />
                    {form.line_items.length > 1 && (
                      <button
                        onClick={() => setForm(f => ({ ...f, line_items: f.line_items.filter((_, i) => i !== idx) }))}
                        className="p-2 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, line_items: [...f.line_items, { label: '', amount: 0 }] }))}
                className="mt-2 text-xs text-[var(--navy)] font-semibold flex items-center gap-1"
              >
                <Plus size={13} />
                Add line item
              </button>
            </div>

            {/* Total */}
            {lineTotal > 0 && (
              <div className="flex justify-between items-center px-1 pt-1 border-t border-[var(--border-light)]">
                <span className="text-sm font-semibold text-[var(--text)]">Total</span>
                <span className="font-mono font-bold text-lg text-[var(--navy)]">${lineTotal.toLocaleString()}</span>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleCreateInvoice}
              disabled={saving || !form.project_id || !form.title}
              className="w-full py-3.5 rounded-xl bg-[var(--navy)] text-white font-semibold text-sm min-h-[48px] disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
          </div>
        </div>
      )}

      {/* ── Mark Paid Modal ──────────────────────────────────────────────────── */}
      {markPaidInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMarkPaidInvoice(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl p-5 space-y-4 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--success-bg)] flex items-center justify-center">
                <DollarSign size={18} className="text-[var(--success)]" />
              </div>
              <div>
                <h2 className="font-display text-lg text-[var(--navy)]">Mark as Paid</h2>
                <p className="text-xs text-[var(--text-tertiary)]">{String(markPaidInvoice.invoice_number ?? '')}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Amount Received</label>
              <input
                type="number"
                value={paidForm.amount}
                onChange={e => setPaidForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] font-mono min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Payment Method</label>
              <select
                value={paidForm.method}
                onChange={e => setPaidForm(f => ({ ...f, method: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
              >
                <option value="check">Check</option>
                <option value="ach">ACH / Bank transfer</option>
                <option value="credit_card">Credit card</option>
                <option value="cash">Cash</option>
                <option value="zelle">Zelle</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Payment Date</label>
              <input
                type="date"
                value={paidForm.date}
                onChange={e => setPaidForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setMarkPaidInvoice(null)}
                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[var(--success)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
