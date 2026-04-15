import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Lock, Unlock, Check, X, Sparkles, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import type { BudgetTrade, BudgetQuote, TradeCategory } from '@/data/mock'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<TradeCategory, string> = {
  structural:    'bg-blue-100 text-blue-700',
  exterior:      'bg-green-100 text-green-700',
  mep:           'bg-purple-100 text-purple-700',
  interior_subs: 'bg-orange-100 text-orange-700',
  crew:          'bg-[var(--cream-light)] text-[var(--navy)]',
  other:         'bg-gray-100 text-gray-600',
}

interface AddQuoteForm {
  company_name: string
  contact_name: string
  contact_phone: string
  amount: string
  quote_date: string
  scope_included: string
  scope_excluded: string
  includes_materials: boolean
  notes: string
}

const EMPTY_FORM: AddQuoteForm = {
  company_name: '', contact_name: '', contact_phone: '',
  amount: '', quote_date: new Date().toISOString().split('T')[0],
  scope_included: '', scope_excluded: '',
  includes_materials: false, notes: '',
}

interface Props {
  projectId: string
  trades: BudgetTrade[]
  quotes: BudgetQuote[]
  onTradesChange: (trades: BudgetTrade[]) => void
  onQuotesChange: (quotes: BudgetQuote[]) => void
}

function fmt(n: number) { return '$' + n.toLocaleString() }
function variance(awarded: number | null, budget: number) {
  if (awarded == null) return null
  return awarded - budget
}

export function QuoteCollection({ projectId, trades, quotes, onTradesChange, onQuotesChange }: Props) {
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)  // trade_id
  const [form, setForm] = useState<AddQuoteForm>(EMPTY_FORM)
  const [confirmAward, setConfirmAward] = useState<{ quoteId: string; tradeId: string } | null>(null)
  const [confirmLock, setConfirmLock] = useState<string | null>(null) // trade_id
  const [aiLoading, setAiLoading] = useState<string | null>(null) // trade_id

  // Derived metrics
  const totalBudgetTarget = trades.reduce((s, t) => s + t.budget_amount, 0)
  const totalAwarded      = trades.filter(t => t.awarded_amount != null).reduce((s, t) => s + (t.awarded_amount ?? 0), 0)
  const quotesCount       = quotes.length
  const lockedCount       = trades.filter(t => t.is_locked).length
  const overBudget        = totalAwarded > totalBudgetTarget * 1.10

  const statusForTrade = (trade: BudgetTrade): string => {
    if (trade.is_locked) return 'locked'
    if (trade.awarded_amount != null) return 'awarded'
    const tq = quotes.filter(q => q.trade_id === trade.id)
    if (tq.length > 0) return 'quotes_in'
    return 'no_quotes'
  }

  const STATUS_PILL: Record<string, string> = {
    locked:    'bg-[var(--cream-light)] text-[var(--text-secondary)]',
    awarded:   'bg-[var(--success-bg)] text-[var(--success)]',
    quotes_in: 'bg-blue-50 text-blue-700',
    no_quotes: 'bg-gray-100 text-gray-500',
  }
  const STATUS_LABEL: Record<string, string> = {
    locked: 'Locked', awarded: 'Awarded', quotes_in: 'Quotes In', no_quotes: 'No Quotes',
  }

  // Award a quote
  const doAward = (quoteId: string, tradeId: string) => {
    const quote = quotes.find(q => q.id === quoteId)
    if (!quote) return

    // Update quotes: award this, decline others for same trade
    const newQuotes = quotes.map(q => {
      if (q.id === quoteId)    return { ...q, status: 'awarded' as const, awarded_at: new Date().toISOString() }
      if (q.trade_id === tradeId) return { ...q, status: 'declined' as const }
      return q
    })

    // Update trade
    const newTrades = trades.map(t =>
      t.id === tradeId
        ? { ...t, awarded_amount: quote.amount, awarded_subcontractor_id: quote.subcontractor_id }
        : t
    )

    onQuotesChange(newQuotes)
    onTradesChange(newTrades)

    // TODO: upsert to project_subcontractors when DB table is ready

    setConfirmAward(null)
  }

  // Lock a trade
  const doLock = (tradeId: string) => {
    onTradesChange(trades.map(t =>
      t.id === tradeId
        ? { ...t, is_locked: true, locked_at: new Date().toISOString() }
        : t
    ))
    setConfirmLock(null)
  }

  // Unlock a trade
  const doUnlock = (tradeId: string) => {
    onTradesChange(trades.map(t =>
      t.id === tradeId ? { ...t, is_locked: false, locked_at: null } : t
    ))
  }

  // Add quote
  const submitQuote = (tradeId: string) => {
    if (!form.company_name.trim() || !form.amount) return
    const newQ: BudgetQuote = {
      id: `bq-${Date.now()}`,
      trade_id: tradeId,
      project_id: projectId,
      subcontractor_id: null,
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      amount: parseFloat(form.amount),
      quote_date: form.quote_date,
      expiry_date: null,
      scope_included: form.scope_included || null,
      scope_excluded: form.scope_excluded || null,
      includes_materials: form.includes_materials,
      notes: form.notes || null,
      status: 'received',
      awarded_at: null,
      ai_analysis: null,
      document_url: null,
    }
    onQuotesChange([...quotes, newQ])
    setAddingFor(null)
    setForm(EMPTY_FORM)
  }

  // Simulated AI comparison
  const triggerAI = (tradeId: string) => {
    setAiLoading(tradeId)
    setTimeout(() => {
      const trade = trades.find(t => t.id === tradeId)
      const tq = quotes.filter(q => q.trade_id === tradeId && q.status !== 'declined')
      const sorted = [...tq].sort((a, b) => a.amount - b.amount)
      const analysis = sorted.length >= 2
        ? `${sorted[0].company_name} (${fmt(sorted[0].amount)}${sorted[0].includes_materials ? ' incl. materials' : ' — labor only'}) vs ${sorted[1].company_name} (${fmt(sorted[1].amount)}${sorted[1].includes_materials ? ' incl. materials' : ' — labor only'}). ${sorted[0].includes_materials && !sorted[1].includes_materials ? `${sorted[1].company_name}'s labor-only bid needs ~$${Math.round((sorted[1].amount * 0.16)).toLocaleString()} in materials added — making ${sorted[0].company_name} the stronger value.` : `Both bids are comparable in scope. ${sorted[0].company_name} comes in ${fmt(sorted[1].amount - sorted[0].amount)} less.`}`
        : `Only one quote for ${trade?.name}. Request at least one more for a proper comparison.`

      onQuotesChange(quotes.map(q =>
        q.trade_id === tradeId && q.status !== 'declined'
          ? { ...q, ai_analysis: q.ai_analysis ?? analysis }
          : q
      ))
      setAiLoading(null)
    }, 1200)
  }

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Budget Target</p>
          <p className="font-mono text-xl font-bold text-[var(--text)] mt-1">${(totalBudgetTarget / 1000).toFixed(0)}K</p>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Quotes Received</p>
          <p className="font-mono text-xl font-bold text-[var(--text)] mt-1">{quotesCount}</p>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Trades Locked</p>
          <p className={`font-mono text-xl font-bold mt-1 ${lockedCount === trades.length ? 'text-[var(--success)]' : 'text-[var(--text)]'}`}>
            {lockedCount} / {trades.length}
          </p>
        </div>
        <div className={`border rounded-2xl p-3 ${overBudget ? 'bg-[var(--danger-bg)] border-red-100' : 'bg-[var(--success-bg)] border-green-100'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Budget Status</p>
          <p className={`font-mono text-xl font-bold mt-1 ${overBudget ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
            {overBudget ? 'Over' : 'On Track'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {totalAwarded > 0 && (
        <div>
          <div className="flex justify-between mb-1">
            <p className="text-xs text-[var(--text-tertiary)]">Awarded vs. target</p>
            <p className={`text-xs font-mono font-semibold ${overBudget ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
              {fmt(totalAwarded)} / {fmt(totalBudgetTarget)}
            </p>
          </div>
          <div className="h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${overBudget ? 'bg-[var(--danger)]' : totalAwarded / totalBudgetTarget > 0.9 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'}`}
              style={{ width: `${Math.min(100, (totalAwarded / totalBudgetTarget) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Trade list */}
      <SectionHeader title="Trade Quotes" />
      <Card padding="none">
        {trades.sort((a, b) => a.sort_order - b.sort_order).map(trade => {
          const tradeQuotes = quotes.filter(q => q.trade_id === trade.id)
          const isExpanded = expandedTrade === trade.id
          const status = statusForTrade(trade)
          const v = variance(trade.awarded_amount, trade.budget_amount)
          const aiQuote = tradeQuotes.find(q => q.ai_analysis)

          return (
            <div key={trade.id} className={cn('border-b border-[var(--border-light)] last:border-0', trade.is_locked ? 'bg-gray-50' : '')}>
              {/* Trade row (collapsed) */}
              <button
                onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left min-h-[44px]"
              >
                {/* Expand icon */}
                {isExpanded
                  ? <ChevronDown size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  : <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
                }

                {/* Trade name + category */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('font-medium text-sm', trade.is_locked ? 'text-[var(--text-tertiary)]' : 'text-[var(--text)]')}>
                      {trade.name}
                    </p>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[trade.trade_category]}`}>
                      {trade.trade_category.replace('_', ' ')}
                    </span>
                  </div>
                  {tradeQuotes.filter(q => q.status !== 'declined').length > 0 && (
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {tradeQuotes.filter(q => q.status !== 'declined').length} quote{tradeQuotes.filter(q => q.status !== 'declined').length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {trade.awarded_amount != null && v != null && (
                    <span className={`text-xs font-mono font-semibold ${v > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                      {v > 0 ? `+${fmt(v)}` : `-${fmt(Math.abs(v))}`}
                    </span>
                  )}
                  {trade.awarded_amount != null && (
                    <p className="font-mono text-sm font-bold text-[var(--text)]">{fmt(trade.awarded_amount)}</p>
                  )}
                  {trade.awarded_amount == null && (
                    <p className="font-mono text-xs text-[var(--text-tertiary)]">{fmt(trade.budget_amount)}</p>
                  )}
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_PILL[status]}`}>
                    {trade.is_locked && <Lock size={9} className="inline mr-0.5" />}
                    {STATUS_LABEL[status]}
                  </span>
                </div>
              </button>

              {/* Expanded: quotes + actions */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* AI analysis bar */}
                  {aiQuote?.ai_analysis && (
                    <div className="flex items-start gap-2.5 p-3 bg-[var(--navy)] rounded-2xl">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={12} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide mb-1">AI Analysis</p>
                        <p className="text-white text-xs leading-relaxed">{aiQuote.ai_analysis}</p>
                      </div>
                    </div>
                  )}

                  {/* Quote cards */}
                  {tradeQuotes.map(q => {
                    const isAwarded  = q.status === 'awarded'
                    const isDeclined = q.status === 'declined'
                    return (
                      <div
                        key={q.id}
                        className={cn(
                          'rounded-2xl border p-3',
                          isAwarded  ? 'border-[var(--success)] bg-[var(--success-bg)]' :
                          isDeclined ? 'border-[var(--border-light)] opacity-50'        :
                                       'border-[var(--border-light)] bg-[var(--white)]'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold text-sm text-[var(--text)]">{q.company_name}</p>
                            {q.contact_name && <p className="text-xs text-[var(--text-tertiary)]">{q.contact_name} · {q.contact_phone}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-lg font-bold text-[var(--text)]">{fmt(q.amount)}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">{q.quote_date}</p>
                          </div>
                        </div>

                        {q.scope_included && (
                          <p className="text-xs text-[var(--text-secondary)] mb-1">
                            <span className="font-semibold text-[var(--text-tertiary)]">Includes: </span>
                            {q.scope_included}
                          </p>
                        )}
                        {q.scope_excluded && (
                          <p className="text-xs text-[var(--text-secondary)] mb-2">
                            <span className="font-semibold text-[var(--danger)]">Excludes: </span>
                            {q.scope_excluded}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {q.includes_materials && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                              Includes materials
                            </span>
                          )}
                          {isAwarded && (
                            <span className="text-[10px] bg-[var(--success-bg)] text-[var(--success)] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide flex items-center gap-1">
                              <Check size={9} /> Awarded
                            </span>
                          )}
                          {isDeclined && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                              Declined
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        {!trade.is_locked && !isDeclined && !isAwarded && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setConfirmAward({ quoteId: q.id, tradeId: trade.id })}
                              className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 min-h-[44px]"
                            >
                              <Check size={13} />
                              Award this quote
                            </button>
                            <button
                              onClick={() => onQuotesChange(quotes.map(qq => qq.id === q.id ? { ...qq, status: 'declined' as const } : qq))}
                              className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] flex items-center justify-center min-h-[44px]"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* AI compare button (2+ active quotes) */}
                  {tradeQuotes.filter(q => q.status !== 'declined').length >= 2 && !aiQuote?.ai_analysis && (
                    <button
                      onClick={() => triggerAI(trade.id)}
                      disabled={aiLoading === trade.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--navy)]/30 text-[var(--navy)] text-xs font-semibold transition-colors hover:bg-[var(--cream-light)] min-h-[44px]"
                    >
                      {aiLoading === trade.id
                        ? <div className="w-3.5 h-3.5 border-2 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
                        : <Sparkles size={13} />
                      }
                      {aiLoading === trade.id ? 'Analyzing...' : 'Compare all quotes with AI'}
                    </button>
                  )}

                  {/* Add quote + lock buttons */}
                  {!trade.is_locked && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAddingFor(trade.id); setForm(EMPTY_FORM) }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] font-medium min-h-[44px]"
                      >
                        <Plus size={14} />
                        Add quote
                      </button>
                      {trade.awarded_amount != null && (
                        <button
                          onClick={() => setConfirmLock(trade.id)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--rust)] text-white text-sm font-semibold min-h-[44px]"
                        >
                          <Lock size={14} />
                          Lock
                        </button>
                      )}
                    </div>
                  )}

                  {trade.is_locked && (
                    <button
                      onClick={() => doUnlock(trade.id)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-[var(--border)] text-xs text-[var(--text-tertiary)] min-h-[44px]"
                    >
                      <Unlock size={12} />
                      Unlock trade (admin only)
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* Add quote slide-over (inline modal) */}
      {addingFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddingFor(null)} />
          <div className="relative bg-[var(--white)] rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90svh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-[var(--text)]">
                Add Quote — {trades.find(t => t.id === addingFor)?.name}
              </p>
              <button onClick={() => setAddingFor(null)} className="text-[var(--text-tertiary)]"><X size={18} /></button>
            </div>

            {[
              { key: 'company_name',   label: 'Company name *',   type: 'text' },
              { key: 'contact_name',   label: 'Contact name',     type: 'text' },
              { key: 'contact_phone',  label: 'Phone',            type: 'tel'  },
              { key: 'amount',         label: 'Quote amount *',   type: 'number', prefix: '$' },
              { key: 'quote_date',     label: 'Quote date',       type: 'date'  },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[var(--text-tertiary)] block mb-1">{f.label}</label>
                <div className="relative">
                  {f.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">{f.prefix}</span>}
                  <input
                    type={f.type}
                    className={`w-full py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] ${f.prefix ? 'pl-7' : 'pl-3'} pr-3`}
                    value={(form as unknown as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Scope included</label>
              <textarea
                className="w-full py-2.5 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
                rows={2}
                value={form.scope_included}
                onChange={e => setForm(prev => ({ ...prev, scope_included: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Scope excluded</label>
              <textarea
                className="w-full py-2.5 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
                rows={2}
                value={form.scope_excluded}
                onChange={e => setForm(prev => ({ ...prev, scope_excluded: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm(prev => ({ ...prev, includes_materials: !prev.includes_materials }))}
                className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${form.includes_materials ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.includes_materials ? 'left-5' : 'left-0.5'}`} />
              </button>
              <label className="text-sm text-[var(--text)]">Includes materials</label>
            </div>

            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Notes</label>
              <textarea
                className="w-full py-2.5 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* Upload placeholder */}
            <div className="flex items-center gap-2 p-3 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-tertiary)]">
              <FileText size={14} />
              Upload quote document (PDF / photo)
            </div>

            <Button fullWidth onClick={() => submitQuote(addingFor!)}>
              Add Quote
            </Button>
          </div>
        </div>
      )}

      {/* Confirm award dialog */}
      {confirmAward && (() => {
        const q = quotes.find(qq => qq.id === confirmAward.quoteId)
        const t = trades.find(tt => tt.id === confirmAward.tradeId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmAward(null)} />
            <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
              <p className="font-semibold text-[var(--text)] mb-2">Award this quote?</p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Award <span className="font-semibold">{q?.company_name}</span> at <span className="font-mono font-bold">${q?.amount.toLocaleString()}</span> for <span className="font-semibold">{t?.name}</span>?
                All other quotes for this trade will be declined.
              </p>
              <div className="flex gap-2">
                <button onClick={() => doAward(confirmAward.quoteId, confirmAward.tradeId)} className="flex-1 py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold min-h-[44px]">
                  Confirm Award
                </button>
                <button onClick={() => setConfirmAward(null)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] min-h-[44px]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Confirm lock dialog */}
      {confirmLock && (() => {
        const t = trades.find(tt => tt.id === confirmLock)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmLock(null)} />
            <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
              <Lock size={24} className="text-[var(--rust)] mb-3" />
              <p className="font-semibold text-[var(--text)] mb-2">Lock this trade?</p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Lock <span className="font-semibold">{t?.name}</span> at <span className="font-mono font-bold">${t?.awarded_amount?.toLocaleString()}</span>? Locked trades feed into the Final Price. You can unlock later to correct a mistake.
              </p>
              <div className="flex gap-2">
                <button onClick={() => doLock(confirmLock!)} className="flex-1 py-3 rounded-xl bg-[var(--rust)] text-white text-sm font-semibold min-h-[44px]">
                  Lock Trade
                </button>
                <button onClick={() => setConfirmLock(null)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] min-h-[44px]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
