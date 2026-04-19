// Balance-at-a-glance card for the admin project Financials tab and for the
// client portal's project overview. Reads from v_project_balance (one row
// per project with contract base, CO totals, invoiced, paid, remaining) and
// pairs it with a running list of change orders so Adam can see at a glance
// exactly where a project stands and what's queued to bill.
//
// Also surfaces the "Build invoice from proposal" action when there's a
// parent proposal — opens BuildInvoiceFromProposalSheet.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, DollarSign, FileText, Plus, Send, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { BuildInvoiceFromProposalSheet } from './BuildInvoiceFromProposalSheet'

interface ProjectBalance {
  project_id: string
  project_title: string
  client_name: string | null
  proposal_id: string | null
  contract_base: string | number
  change_order_total: string | number
  invoiced_to_date: string | number
  paid_to_date: string | number
  unrolled_priced_co_total: string | number
}

interface ChangeOrderRow {
  id: string
  title: string
  description: string
  status: string | null
  cost_change: number | null
  flagged_at: string | null
  flagged_by: string | null
  priced_at: string | null
  rolled_into_invoice_id: string | null
}

interface Props {
  projectId: string
  /** When true, hide admin-only actions (price CO, build invoice). */
  readOnly?: boolean
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function toNum(v: string | number | null | undefined): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

export function ProjectBalanceCard({ projectId, readOnly }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showBuild, setShowBuild] = useState(false)
  const [pricingId, setPricingId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: balance } = useQuery<ProjectBalance | null>({
    queryKey: ['project-balance', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_project_balance')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()
      return (data ?? null) as ProjectBalance | null
    },
  })

  const { data: changeOrders = [] } = useQuery<ChangeOrderRow[]>({
    queryKey: ['project-change-orders', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('change_orders')
        .select('id, title, description, status, cost_change, flagged_at, flagged_by, priced_at, rolled_into_invoice_id')
        .eq('project_id', projectId)
        .order('flagged_at', { ascending: false, nullsFirst: false })
      return (data ?? []) as ChangeOrderRow[]
    },
  })

  const base = toNum(balance?.contract_base)
  const coTotal = toNum(balance?.change_order_total)
  const grand = base + coTotal
  const invoiced = toNum(balance?.invoiced_to_date)
  const paid = toNum(balance?.paid_to_date)
  const remaining = Math.max(0, grand - paid)
  const unrolledCoTotal = toNum(balance?.unrolled_priced_co_total)
  const pctPaid = grand > 0 ? Math.min(100, (paid / grand) * 100) : 0
  const pctInvoiced = grand > 0 ? Math.min(100, (invoiced / grand) * 100) : 0

  const flagged = useMemo(
    () => changeOrders.filter(c => (c.cost_change ?? 0) === 0 && !c.rolled_into_invoice_id),
    [changeOrders],
  )
  const pricedUnrolled = useMemo(
    () => changeOrders.filter(c => (c.cost_change ?? 0) !== 0 && !c.rolled_into_invoice_id),
    [changeOrders],
  )
  const rolled = useMemo(
    () => changeOrders.filter(c => !!c.rolled_into_invoice_id),
    [changeOrders],
  )

  const startPricing = (co: ChangeOrderRow) => {
    setPricingId(co.id)
    setPriceDraft(co.cost_change ? String(co.cost_change) : '')
  }

  const submitPrice = async (id: string) => {
    const n = parseFloat(priceDraft)
    if (!Number.isFinite(n) || n <= 0) return
    setBusyId(id)
    const { error } = await supabase
      .from('change_orders')
      .update({
        cost_change: n,
        status: 'priced',
        priced_by: user?.id ?? null,
        priced_at: new Date().toISOString(),
      })
      .eq('id', id)
    setBusyId(null)
    if (error) {
      alert(`Couldn't save price: ${error.message}`)
      return
    }
    setPricingId(null)
    setPriceDraft('')
    queryClient.invalidateQueries({ queryKey: ['project-change-orders', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] })
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Balance</p>
            <p className="font-display text-2xl text-[var(--navy)]">{fmtUsd(remaining)} remaining</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {fmtUsd(paid)} paid of {fmtUsd(grand)} total
              {coTotal > 0 && <> (base {fmtUsd(base)} + changes {fmtUsd(coTotal)})</>}
            </p>
          </div>
          {!readOnly && balance?.proposal_id && (
            <Button size="sm" onClick={() => setShowBuild(true)}>
              <Plus size={13} /> Build invoice
            </Button>
          )}
        </div>

        {/* Layered progress bar: paid (solid), invoiced-but-unpaid (stripe), remaining (muted). */}
        <div className="relative h-2.5 rounded-full bg-[var(--border-light)] overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-[var(--navy)]/30"
            style={{ width: `${pctInvoiced}%` }}
            title="Invoiced"
          />
          <div
            className="absolute top-0 left-0 h-full bg-[var(--success)]"
            style={{ width: `${pctPaid}%` }}
            title="Paid"
          />
        </div>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
            Paid {fmtUsd(paid)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--navy)]/30" />
            Invoiced {fmtUsd(invoiced)}
          </span>
          {unrolledCoTotal !== 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--warning)]">
              <AlertTriangle size={11} />
              {fmtUsd(Math.abs(unrolledCoTotal))} in priced changes not yet invoiced
            </span>
          )}
        </div>
      </Card>

      {/* Change orders inbox — admin has actions, client view is read-only. */}
      <SectionHeader title="Change orders" />
      <Card padding="none">
        {changeOrders.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No change orders on this project.</div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {flagged.length > 0 && (
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--warning)] mb-2">
                  Flagged ({flagged.length}) — needs pricing
                </p>
                <div className="space-y-2">
                  {flagged.map(co => (
                    <div key={co.id} className="flex items-start gap-2 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text)]">{co.title}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                          Flagged {co.flagged_at ? new Date(co.flagged_at).toLocaleString() : '—'}
                        </p>
                      </div>
                      {!readOnly && pricingId !== co.id && (
                        <button
                          onClick={() => startPricing(co)}
                          className="text-[11px] font-semibold text-[var(--navy)] border border-[var(--navy)]/30 px-2 py-1 rounded-lg flex-shrink-0"
                        >
                          <DollarSign size={11} className="inline -mt-0.5" /> Price it
                        </button>
                      )}
                      {pricingId === co.id && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            value={priceDraft}
                            onChange={e => setPriceDraft(e.target.value)}
                            placeholder="$"
                            className="w-20 px-2 py-1 text-xs border border-[var(--border)] rounded-lg"
                            autoFocus
                          />
                          <button
                            onClick={() => submitPrice(co.id)}
                            disabled={busyId === co.id}
                            className="p-1 rounded bg-[var(--success)] text-white"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => { setPricingId(null); setPriceDraft('') }}
                            className="p-1 rounded border border-[var(--border)]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pricedUnrolled.length > 0 && (
              <div className="p-4 bg-[var(--success-bg)]/30">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--success)] mb-2">
                  Priced ({pricedUnrolled.length}) — rolls into next invoice
                </p>
                <div className="space-y-1">
                  {pricedUnrolled.map(co => (
                    <div key={co.id} className="flex items-center justify-between gap-2 py-1">
                      <p className="text-sm text-[var(--text)] flex-1 truncate">{co.title}</p>
                      <p className="text-sm font-mono font-semibold text-[var(--success)] flex-shrink-0">
                        {fmtUsd(toNum(co.cost_change))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rolled.length > 0 && (
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                  Rolled into invoices ({rolled.length})
                </p>
                <div className="space-y-1">
                  {rolled.map(co => (
                    <div key={co.id} className="flex items-center justify-between gap-2 py-1">
                      <p className="text-sm text-[var(--text-secondary)] flex-1 truncate">{co.title}</p>
                      <p className="text-sm font-mono text-[var(--text-secondary)] flex-shrink-0">
                        {fmtUsd(toNum(co.cost_change))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {showBuild && balance?.proposal_id && (
        <BuildInvoiceFromProposalSheet
          projectId={projectId}
          proposalId={balance.proposal_id}
          onClose={() => setShowBuild(false)}
          onCreated={() => {
            setShowBuild(false)
            queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-change-orders', projectId] })
            queryClient.invalidateQueries({ queryKey: ['project-invoices', projectId] })
          }}
        />
      )}

      {/* icons imported but not otherwise used on some branches — keep the
          lint happy. */}
      <span className="hidden"><FileText size={1} /><Send size={1} /></span>
    </>
  )
}
