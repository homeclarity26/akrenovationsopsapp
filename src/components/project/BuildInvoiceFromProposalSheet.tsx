// Sheet: "Build invoice from proposal"
// Lets admin pick a milestone (deposit / rough-in / final / custom) and check
// priced change orders to roll into this invoice. On save, inserts one row
// into invoices with proposal_id + milestone_label + base/CO breakdown, and
// atomically updates the rolled change_orders with rolled_into_invoice_id.

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Check, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface Milestone {
  label: string
  percent: number  // 0..1
}

interface ProposalRow {
  id: string
  title: string | null
  client_name: string | null
  total_price: number | null
  payment_schedule: Milestone[] | null
}

interface ChangeOrderRow {
  id: string
  title: string
  cost_change: number | null
}

interface Props {
  projectId: string
  proposalId: string
  onClose: () => void
  onCreated: () => void
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function nextInvoiceNumber(): string {
  const now = new Date()
  const yy = now.getFullYear()
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `INV-${yy}-${rand}`
}

export function BuildInvoiceFromProposalSheet({ projectId, proposalId, onClose, onCreated }: Props) {
  const [milestoneIdx, setMilestoneIdx] = useState<number | 'custom'>(0)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedCoIds, setSelectedCoIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: proposal } = useQuery<ProposalRow | null>({
    queryKey: ['proposal-for-invoice-build', proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('id, title, client_name, total_price, payment_schedule')
        .eq('id', proposalId)
        .maybeSingle()
      return (data ?? null) as ProposalRow | null
    },
  })

  const { data: pricedCOs = [] } = useQuery<ChangeOrderRow[]>({
    queryKey: ['priced-unrolled-cos', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('change_orders')
        .select('id, title, cost_change')
        .eq('project_id', projectId)
        .is('rolled_into_invoice_id', null)
        .not('cost_change', 'is', null)
      const rows = (data ?? []) as ChangeOrderRow[]
      return rows.filter(r => (r.cost_change ?? 0) !== 0)
    },
  })

  // Pre-select all priced unrolled COs by default.
  useEffect(() => {
    if (pricedCOs.length > 0 && selectedCoIds.size === 0) {
      setSelectedCoIds(new Set(pricedCOs.map(c => c.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedCOs.length])

  const contractBase = Number(proposal?.total_price ?? 0)
  const milestones: Milestone[] = useMemo(
    () => (proposal?.payment_schedule ?? []).filter(m => typeof m?.percent === 'number'),
    [proposal?.payment_schedule],
  )

  const baseAmount = useMemo(() => {
    if (milestoneIdx === 'custom') return parseFloat(customAmount) || 0
    const m = milestones[milestoneIdx as number]
    if (!m) return 0
    return Math.round(contractBase * m.percent * 100) / 100
  }, [milestoneIdx, customAmount, milestones, contractBase])

  const coAmount = useMemo(
    () => pricedCOs
      .filter(c => selectedCoIds.has(c.id))
      .reduce((sum, c) => sum + (c.cost_change ?? 0), 0),
    [pricedCOs, selectedCoIds],
  )
  const total = baseAmount + coAmount

  const milestoneLabel = milestoneIdx === 'custom'
    ? 'Custom'
    : milestones[milestoneIdx as number]?.label ?? 'Milestone'
  const milestonePercent = milestoneIdx === 'custom' ? null
    : milestones[milestoneIdx as number]?.percent ?? null

  const toggleCo = (id: string) => {
    setSelectedCoIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    setError(null)
    if (total <= 0) { setError('Invoice total must be greater than $0'); return }
    setSaving(true)
    try {
      const invoiceNumber = nextInvoiceNumber()
      const lineItems: Array<Record<string, unknown>> = []
      if (baseAmount > 0) {
        lineItems.push({
          kind: 'base',
          label: `${milestoneLabel} — base contract`,
          amount: baseAmount,
        })
      }
      for (const co of pricedCOs) {
        if (!selectedCoIds.has(co.id)) continue
        lineItems.push({
          kind: 'change_order',
          label: `Change: ${co.title}`,
          amount: co.cost_change ?? 0,
          source_change_order_id: co.id,
        })
      }

      const { data: invRow, error: invErr } = await supabase
        .from('invoices')
        .insert({
          project_id: projectId,
          proposal_id: proposalId,
          invoice_number: invoiceNumber,
          title: `${milestoneLabel} — ${proposal?.title ?? 'Project'}`,
          line_items: lineItems,
          milestone_label: milestoneLabel,
          milestone_percent: milestonePercent,
          base_amount: baseAmount,
          change_order_amount: coAmount,
          total,
          balance_due: total,
          status: 'draft',
        })
        .select('id')
        .single()
      if (invErr || !invRow) throw invErr ?? new Error('Insert returned no row')

      // Mark selected COs as rolled into this invoice.
      if (selectedCoIds.size > 0) {
        const { error: coErr } = await supabase
          .from('change_orders')
          .update({
            rolled_into_invoice_id: invRow.id,
            rolled_into_at: new Date().toISOString(),
            status: 'invoiced',
          })
          .in('id', Array.from(selectedCoIds))
        if (coErr) throw coErr
      }

      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-base text-[var(--text)]">Build invoice from proposal</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {proposal?.title ?? 'Proposal'} — {proposal?.client_name ?? ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-[var(--text-tertiary)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Contract</p>
          <p className="font-display text-lg text-[var(--navy)]">{fmtUsd(contractBase)}</p>
        </Card>

        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Milestone to invoice</p>
          <div className="space-y-2">
            {milestones.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">
                This proposal has no payment schedule. Use custom amount below.
              </p>
            )}
            {milestones.map((m, i) => (
              <label key={`${m.label}-${i}`} className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="milestone"
                  checked={milestoneIdx === i}
                  onChange={() => setMilestoneIdx(i)}
                />
                <span className="flex-1 text-sm text-[var(--text)]">
                  {m.label} ({(m.percent * 100).toFixed(0)}% = {fmtUsd(contractBase * m.percent)})
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-xl cursor-pointer">
              <input
                type="radio"
                name="milestone"
                checked={milestoneIdx === 'custom'}
                onChange={() => setMilestoneIdx('custom')}
              />
              <span className="text-sm text-[var(--text)]">Custom amount</span>
              {milestoneIdx === 'custom' && (
                <input
                  type="number"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="ml-auto w-28 px-2 py-1 text-sm border border-[var(--border)] rounded-lg"
                  placeholder="$"
                />
              )}
            </label>
          </div>
        </div>

        {pricedCOs.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
              Priced change orders to roll in ({pricedCOs.length})
            </p>
            <div className="space-y-1 border border-[var(--border)] rounded-xl divide-y divide-[var(--border-light)]">
              {pricedCOs.map(co => {
                const checked = selectedCoIds.has(co.id)
                return (
                  <label key={co.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCo(co.id)}
                    />
                    <span className="flex-1 text-sm text-[var(--text)] truncate">{co.title}</span>
                    <span className="text-sm font-mono font-semibold text-[var(--text-secondary)]">
                      {fmtUsd(co.cost_change ?? 0)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <Card className="mt-4 bg-[var(--bg)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">Invoice total</p>
            <p className="font-display text-xl text-[var(--navy)]">{fmtUsd(total)}</p>
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
            Base {fmtUsd(baseAmount)} + changes {fmtUsd(coAmount)}
          </div>
        </Card>

        {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving || total <= 0}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Creating…' : 'Create invoice'}
          </Button>
        </div>
      </div>
    </div>
  )
}
