import { useState } from 'react'
import { Plus, X, ShoppingBag, Check, Clock, Package, TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import type { BudgetTrade } from '@/data/mock'

export interface BudgetSelection {
  id: string
  project_id: string
  budget_trade_id: string | null
  category: string
  item_name: string
  budget_allowance: number
  status: 'pending' | 'selected' | 'approved' | 'ordered' | 'received'
  selected_product: string | null
  estimated_cost: number | null
}

interface AddSelectionForm {
  category: string
  item_name: string
  budget_allowance: string
  budget_trade_id: string
}

const EMPTY_FORM: AddSelectionForm = {
  category: '',
  item_name: '',
  budget_allowance: '',
  budget_trade_id: '',
}

const STATUS_PILL: Record<BudgetSelection['status'], string> = {
  pending:  'bg-gray-100 text-gray-500',
  selected: 'bg-blue-50 text-blue-700',
  approved: 'bg-[var(--success-bg)] text-[var(--success)]',
  ordered:  'bg-[var(--warning-bg)] text-[var(--warning)]',
  received: 'bg-[var(--cream-light)] text-[var(--navy)]',
}

const STATUS_LABEL: Record<BudgetSelection['status'], string> = {
  pending:  'Pending',
  selected: 'Selected',
  approved: 'Approved',
  ordered:  'Ordered',
  received: 'Received',
}

const STATUS_ICON: Record<BudgetSelection['status'], React.ReactNode> = {
  pending:  <Clock size={11} />,
  selected: <Check size={11} />,
  approved: <Check size={11} />,
  ordered:  <Package size={11} />,
  received: <Check size={11} />,
}

interface Props {
  projectId: string
  trades: BudgetTrade[]
  selections: BudgetSelection[]
  onSelectionsChange: (selections: BudgetSelection[]) => void
}

function fmt(n: number) { return '$' + n.toLocaleString() }

export function BudgetSelectionsStage({ projectId, trades, selections, onSelectionsChange }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<AddSelectionForm>(EMPTY_FORM)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectingFor, setSelectingFor] = useState<string | null>(null)
  const [productInput, setProductInput] = useState('')
  const [costInput, setCostInput] = useState('')

  // Grouped by category
  const categories = Array.from(new Set(selections.map(s => s.category)))

  // Cost summary
  const totalAllowances = selections.reduce((s, sel) => s + sel.budget_allowance, 0)
  const totalConfirmed  = selections
    .filter(s => s.status !== 'pending' && s.estimated_cost != null)
    .reduce((s, sel) => s + (sel.estimated_cost ?? 0), 0)
  const confirmedCount  = selections.filter(s => s.status !== 'pending').length
  const variance        = totalConfirmed - totalAllowances
  const overVariance    = variance > 0

  const addSelection = () => {
    if (!form.category.trim() || !form.item_name.trim() || !form.budget_allowance) return
    const newSel: BudgetSelection = {
      id: `bsel-${Date.now()}`,
      project_id: projectId,
      budget_trade_id: form.budget_trade_id || null,
      category: form.category,
      item_name: form.item_name,
      budget_allowance: parseFloat(form.budget_allowance),
      status: 'pending',
      selected_product: null,
      estimated_cost: null,
    }
    onSelectionsChange([...selections, newSel])
    setAddOpen(false)
    setForm(EMPTY_FORM)
  }

  const submitSelection = (id: string) => {
    if (!productInput.trim()) return
    onSelectionsChange(selections.map(s =>
      s.id === id
        ? { ...s, status: 'selected' as const, selected_product: productInput, estimated_cost: costInput ? parseFloat(costInput) : s.budget_allowance }
        : s
    ))
    setSelectingFor(null)
    setProductInput('')
    setCostInput('')
  }

  return (
    <div className="space-y-4">
      {/* Cost summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Total Allowances</p>
          <p className="font-mono text-lg font-bold text-[var(--text)] mt-1">{fmt(totalAllowances)}</p>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Confirmed</p>
          <p className="font-mono text-lg font-bold text-[var(--success)] mt-1">{fmt(totalConfirmed)}</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{confirmedCount} of {selections.length}</p>
        </div>
        <div className={`border rounded-2xl p-3 ${overVariance ? 'bg-[var(--danger-bg)] border-red-100' : 'bg-[var(--success-bg)] border-green-100'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Variance</p>
          <div className="flex items-center gap-1 mt-1">
            {overVariance
              ? <TrendingUp size={14} className="text-[var(--danger)]" />
              : <TrendingDown size={14} className="text-[var(--success)]" />
            }
            <p className={`font-mono text-lg font-bold ${overVariance ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
              {overVariance ? `+${fmt(Math.abs(variance))}` : (totalConfirmed > 0 ? `-${fmt(Math.abs(variance))}` : '—')}
            </p>
          </div>
        </div>
      </div>

      {/* Selections grouped by category */}
      {categories.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <ShoppingBag size={32} className="text-[var(--border)] mx-auto mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No selections yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Add client material selections to track allowances.</p>
          </div>
        </Card>
      ) : (
        categories.map(cat => {
          const catSelections = selections.filter(s => s.category === cat)
          return (
            <div key={cat}>
              <SectionHeader title={cat} />
              <Card padding="none">
                {catSelections.map(sel => {
                  const isExpanded = expandedId === sel.id
                  const isSelectingThis = selectingFor === sel.id
                  const budgetImpact = sel.estimated_cost != null
                    ? sel.estimated_cost - sel.budget_allowance
                    : null
                  const overAllowance = budgetImpact != null && budgetImpact > 0

                  return (
                    <div key={sel.id} className="border-b border-[var(--border-light)] last:border-0">
                      {/* Row */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : sel.id)}
                        className="w-full flex items-start gap-3 px-4 py-3.5 text-left min-h-[44px]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[var(--text)]">{sel.item_name}</p>
                          {sel.selected_product && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sel.selected_product}</p>
                          )}
                          {budgetImpact != null && (
                            <p className={`text-[11px] font-semibold mt-0.5 ${overAllowance ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                              {overAllowance
                                ? `Over allowance by ${fmt(budgetImpact)}`
                                : `Included in budget`
                              }
                            </p>
                          )}
                          {budgetImpact == null && (
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                              Allowance: {fmt(sel.budget_allowance)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sel.estimated_cost != null && (
                            <p className={`font-mono text-sm font-bold ${overAllowance ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                              {fmt(sel.estimated_cost)}
                            </p>
                          )}
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_PILL[sel.status]}`}>
                            {STATUS_ICON[sel.status]}
                            {STATUS_LABEL[sel.status]}
                          </span>
                        </div>
                      </button>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[var(--bg)] rounded-xl p-2.5">
                              <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Budget allowance</p>
                              <p className="font-mono text-sm font-semibold text-[var(--text)]">{fmt(sel.budget_allowance)}</p>
                            </div>
                            {sel.estimated_cost != null && (
                              <div className={`rounded-xl p-2.5 ${overAllowance ? 'bg-[var(--danger-bg)]' : 'bg-[var(--success-bg)]'}`}>
                                <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Actual cost</p>
                                <p className={`font-mono text-sm font-semibold ${overAllowance ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                                  {fmt(sel.estimated_cost)}
                                </p>
                              </div>
                            )}
                          </div>

                          {sel.budget_trade_id && (
                            <p className="text-xs text-[var(--text-tertiary)]">
                              Linked to: <span className="font-medium text-[var(--text)]">{trades.find(t => t.id === sel.budget_trade_id)?.name ?? sel.budget_trade_id}</span>
                            </p>
                          )}

                          {/* Enter selection form */}
                          {isSelectingThis ? (
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Product selected</label>
                                <input
                                  type="text"
                                  className="w-full py-2 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                                  placeholder="e.g. Andersen 400 Series White"
                                  value={productInput}
                                  onChange={e => setProductInput(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Actual cost</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">$</span>
                                  <input
                                    type="number"
                                    className="w-full py-2 pl-7 pr-3 rounded-xl border border-[var(--border)] text-sm font-mono bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                                    placeholder={String(sel.budget_allowance)}
                                    value={costInput}
                                    onChange={e => setCostInput(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => submitSelection(sel.id)}
                                  className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-xs font-semibold min-h-[44px]"
                                >
                                  Save Selection
                                </button>
                                <button
                                  onClick={() => { setSelectingFor(null); setProductInput(''); setCostInput('') }}
                                  className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] min-h-[44px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {sel.status === 'pending' && (
                                <button
                                  onClick={() => { setSelectingFor(sel.id); setExpandedId(sel.id) }}
                                  className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-xs font-semibold min-h-[44px] flex items-center justify-center gap-1.5"
                                >
                                  <Check size={13} />
                                  Enter selection
                                </button>
                              )}
                              {sel.status === 'selected' && (
                                <button
                                  onClick={() => onSelectionsChange(selections.map(s => s.id === sel.id ? { ...s, status: 'approved' as const } : s))}
                                  className="flex-1 py-2.5 rounded-xl bg-[var(--success)] text-white text-xs font-semibold min-h-[44px] flex items-center justify-center gap-1.5"
                                >
                                  <Check size={13} />
                                  Approve
                                </button>
                              )}
                              {(sel.status === 'approved') && (
                                <button
                                  onClick={() => onSelectionsChange(selections.map(s => s.id === sel.id ? { ...s, status: 'ordered' as const } : s))}
                                  className="flex-1 py-2.5 rounded-xl bg-[var(--warning)] text-white text-xs font-semibold min-h-[44px] flex items-center justify-center gap-1.5"
                                >
                                  <Package size={13} />
                                  Mark ordered
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </Card>
            </div>
          )
        })
      )}

      {/* Add selection button */}
      <button
        onClick={() => setAddOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--navy)] font-medium hover:bg-[var(--cream-light)] transition-colors min-h-[44px]"
      >
        <Plus size={15} />
        Add selection
      </button>

      {/* Add selection slide-over */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative bg-[var(--white)] rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90svh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-[var(--text)]">Add Selection</p>
              <button onClick={() => setAddOpen(false)} className="text-[var(--text-tertiary)]"><X size={18} /></button>
            </div>

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Category *</label>
              <input
                type="text"
                className="w-full py-2.5 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                placeholder="e.g. Flooring, Lighting, Countertop"
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Item / what to look for *</label>
              <input
                type="text"
                className="w-full py-2.5 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                placeholder="e.g. Luxury vinyl plank, 1,200 sq ft"
                value={form.item_name}
                onChange={e => setForm(prev => ({ ...prev, item_name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Budget allowance *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">$</span>
                <input
                  type="number"
                  className="w-full py-2.5 pl-7 pr-3 rounded-xl border border-[var(--border)] text-sm font-mono bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                  placeholder="0"
                  value={form.budget_allowance}
                  onChange={e => setForm(prev => ({ ...prev, budget_allowance: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Link to trade (optional)</label>
              <select
                className="w-full py-2.5 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                value={form.budget_trade_id}
                onChange={e => setForm(prev => ({ ...prev, budget_trade_id: e.target.value }))}
              >
                <option value="">Not linked to a trade</option>
                {trades.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <Button fullWidth onClick={addSelection}>
              Add Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
