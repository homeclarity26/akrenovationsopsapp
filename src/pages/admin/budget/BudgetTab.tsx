import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { BudgetStageIndicator } from './BudgetStageIndicator'
import type { BudgetStage } from './BudgetStageIndicator'
import { BudgetSetup } from './BudgetSetup'
import { QuoteCollection } from './QuoteCollection'
import { BudgetSelectionsStage } from './BudgetSelectionsStage'
import type { BudgetSelection } from './BudgetSelectionsStage'
import { FinalPrice } from './FinalPrice'
import type { BudgetSettings, BudgetTrade, BudgetQuote } from '@/data/mock'

interface Props {
  projectId: string
  projectType: string
}

/**
 * Determines which stage is the "active" default when loading the budget tab.
 * - No settings → Stage 1 (Setup)
 * - Settings + trades + not all locked → Stage 2 (Quote Collection)
 * - Any trade awarded → Stage 3 accessible
 * - All locked → Stage 4 (Final Price)
 */
function computeInitialStage(
  settings: BudgetSettings | undefined,
  trades: BudgetTrade[]
): BudgetStage {
  if (!settings) return 1
  const allLocked  = trades.length > 0 && trades.every(t => t.is_locked)
  const anyAwarded = trades.some(t => t.awarded_amount != null)
  if (allLocked)  return 4
  if (anyAwarded) return 3
  return 2
}

function computeMaxReached(
  settings: BudgetSettings | undefined,
  trades: BudgetTrade[]
): BudgetStage {
  if (!settings) return 1
  const allLocked  = trades.length > 0 && trades.every(t => t.is_locked)
  const anyAwarded = trades.some(t => t.awarded_amount != null)
  if (allLocked)  return 4
  if (anyAwarded) return 3
  return 2
}

export function BudgetTab({ projectId, projectType }: Props) {
  // ── Real Supabase queries ─────────────────────────────────────────────────
  const { data: settingsRow } = useQuery({
    queryKey: ['budget_settings', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_settings')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()
      return data ?? undefined
    },
  })

  const { data: tradesData = [] } = useQuery({
    queryKey: ['budget_trades', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_trades')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
      return (data ?? []) as BudgetTrade[]
    },
  })

  const { data: quotesData = [] } = useQuery({
    queryKey: ['budget_quotes', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_quotes')
        .select('*')
        .eq('project_id', projectId)
      return (data ?? []) as BudgetQuote[]
    },
  })

  const { data: selectionsData = [] } = useQuery({
    queryKey: ['budget_selections', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_selections')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
      return (data ?? []) as BudgetSelection[]
    },
  })

  // ── Local state (overlay on top of server data for optimistic UI) ─────────
  const [settings, setSettings] = useState<BudgetSettings | undefined>(undefined)
  const [trades, setTrades] = useState<BudgetTrade[]>([])
  const [quotes, setQuotes] = useState<BudgetQuote[]>([])
  const [selections, setSelections] = useState<BudgetSelection[]>([])

  // Sync from server data whenever queries resolve
  const resolvedSettings = settings ?? (settingsRow as BudgetSettings | undefined)
  const resolvedTrades   = trades.length > 0 ? trades : tradesData
  const resolvedQuotes   = quotes.length > 0 ? quotes : quotesData
  const resolvedSelections = selections.length > 0 ? selections : (selectionsData as BudgetSelection[])

  const initialStage  = computeInitialStage(resolvedSettings, resolvedTrades)
  const [stage,       setStage]      = useState<BudgetStage>(initialStage)
  const [maxReached,  setMaxReached] = useState<BudgetStage>(computeMaxReached(resolvedSettings, resolvedTrades))

  const advanceTo = (next: BudgetStage) => {
    setStage(next)
    if (next > maxReached) setMaxReached(next)
  }

  // ── Stage 1 save ─────────────────────────────────────────────────────────
  const handleSetupSave = (
    vars: Partial<BudgetSettings>,
    editableTrades: { localId: string; name: string; trade_category: BudgetTrade['trade_category']; budget_amount: number }[]
  ) => {
    const newSettings: BudgetSettings = {
      id:                    resolvedSettings?.id ?? `bs-${Date.now()}`,
      project_id:            projectId,
      sub_markup_percent:    vars.sub_markup_percent    ?? 0.25,
      pm_rate_per_hour:      vars.pm_rate_per_hour      ?? 120,
      pm_hours_per_week:     vars.pm_hours_per_week     ?? 10,
      duration_weeks:        vars.duration_weeks        ?? 18,
      crew_weeks_on_site:    vars.crew_weeks_on_site    ?? 3.5,
      crew_weekly_cost:      vars.crew_weekly_cost      ?? 3300,
      crew_bill_multiplier:  vars.crew_bill_multiplier  ?? 2.0,
      contingency_amount:    vars.contingency_amount    ?? 5000,
      monthly_overhead:      vars.monthly_overhead      ?? 5000,
      final_contract_price:  null,
      final_locked_at:       null,
      final_locked_by:       null,
    }

    const newTrades: BudgetTrade[] = editableTrades.map((et, i) => ({
      id:                       et.localId.startsWith('new-') ? `bt-${Date.now()}-${i}` : et.localId,
      project_id:               projectId,
      name:                     et.name,
      trade_category:           et.trade_category,
      sort_order:               i,
      budget_amount:            et.budget_amount,
      awarded_amount:           null,
      awarded_subcontractor_id: null,
      is_locked:                false,
      locked_at:                null,
      notes:                    null,
    }))

    setSettings(newSettings)
    setTrades(newTrades)
    advanceTo(2)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <BudgetStageIndicator
        current={stage}
        maxReached={maxReached}
        onChange={s => setStage(s)}
      />

      {stage === 1 && (
        <BudgetSetup
          projectId={projectId}
          projectType={projectType}
          existingSettings={resolvedSettings}
          existingTrades={resolvedTrades.length > 0 ? resolvedTrades : undefined}
          onSave={handleSetupSave}
        />
      )}

      {stage === 2 && (
        <QuoteCollection
          projectId={projectId}
          trades={resolvedTrades}
          quotes={resolvedQuotes}
          onTradesChange={updated => {
            setTrades(updated)
            // If any trade is now awarded, unlock Stage 3
            if (updated.some(t => t.awarded_amount != null) && maxReached < 3) {
              setMaxReached(3)
            }
            // If all trades locked, unlock Stage 4
            if (updated.length > 0 && updated.every(t => t.is_locked) && maxReached < 4) {
              setMaxReached(4)
            }
          }}
          onQuotesChange={setQuotes}
        />
      )}

      {stage === 3 && (
        <BudgetSelectionsStage
          projectId={projectId}
          trades={resolvedTrades}
          selections={resolvedSelections}
          onSelectionsChange={setSelections}
        />
      )}

      {stage === 4 && resolvedSettings && (
        <FinalPrice
          projectId={projectId}
          trades={resolvedTrades}
          settings={resolvedSettings}
          onSettingsChange={setSettings}
          onStageChange={s => setStage(s)}
        />
      )}

      {stage === 4 && !resolvedSettings && (
        <div className="p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">Complete Budget Setup first to access Final Price.</p>
          <button
            onClick={() => setStage(1)}
            className="mt-3 text-sm font-semibold text-[var(--navy)] underline underline-offset-2"
          >
            Go to Setup
          </button>
        </div>
      )}
    </div>
  )
}
