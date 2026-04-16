import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { useClientProject } from '@/hooks/useClientProject'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface Invoice {
  id: string
  invoice_number: string
  title: string
  total: number | null
  balance_due: number | null
  paid_amount: number | null
  status: string
  due_date: string | null
  sent_at: string | null
  created_at: string
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dollars(n: number | null | undefined): string {
  if (typeof n !== 'number') return '$0'
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function ClientInvoices() {
  const { data: project } = useClientProject()
  const projectId = project?.id ?? null
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['client-invoices', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, title, total, balance_due, paid_amount, status, due_date, sent_at, created_at')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) {
        console.warn('[ClientInvoices] fetch error:', error.message)
        return []
      }
      return (data ?? []) as Invoice[]
    },
  })

  const handlePayNow = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId)
    try {
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token ?? ''

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Payment failed' }))
        throw new Error(err.error ?? `Error ${res.status}`)
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('[ClientInvoices] pay error:', err)
      alert(err instanceof Error ? err.message : 'Failed to start payment. Please try again.')
    } finally {
      setPayingInvoiceId(null)
    }
  }

  const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount ?? 0), 0)
  const totalOutstanding = invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'voided')
    .reduce((s, i) => s + (i.balance_due ?? (i.total ?? 0) - (i.paid_amount ?? 0)), 0)

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-[var(--navy)]">Invoices</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-4">
          <p className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] mb-1">Paid to Date</p>
          <p className="font-display text-2xl text-[var(--success)]">{dollars(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-4">
          <p className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] mb-1">Outstanding</p>
          <p className="font-display text-2xl text-[var(--text)]">{dollars(totalOutstanding)}</p>
        </div>
      </div>

      {/* Invoices list */}
      <div>
        <SectionHeader title="All Invoices" />
        {isLoading ? (
          <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
        ) : invoices.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)]">
              No invoices yet. They will appear here once your contractor issues them.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <Card key={inv.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{inv.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{inv.invoice_number}</p>
                  </div>
                  <StatusPill status={inv.status} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-semibold text-lg text-[var(--text)]">{dollars(inv.total)}</p>
                    {inv.due_date && inv.status !== 'paid' && (
                      <p className="text-xs text-[var(--warning)]">Due {formatDate(inv.due_date)}</p>
                    )}
                    {!inv.due_date && (
                      <p className="text-xs text-[var(--text-tertiary)]">{formatDate(inv.sent_at ?? inv.created_at)}</p>
                    )}
                  </div>
                  {inv.status !== 'paid' && inv.status !== 'voided' && (
                    <button
                      onClick={() => handlePayNow(inv.id)}
                      disabled={payingInvoiceId === inv.id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--navy)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {payingInvoiceId === inv.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Processing...
                        </>
                      ) : (
                        'Pay Now'
                      )}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
