import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, Sparkles, AlertTriangle, Check, TrendingUp, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { BudgetTrade, BudgetSettings } from '@/data/mock'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

interface Props {
  projectId: string
  trades: BudgetTrade[]
  settings: BudgetSettings
  onSettingsChange: (s: BudgetSettings) => void
  onStageChange: (stage: 1 | 2 | 3 | 4) => void
}

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString()
}

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

// ── Lever slider row ──────────────────────────────────────────────────────────
interface SliderRowProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  contribution: number
  disabled: boolean
  onChange: (v: number) => void
}

function SliderRow({ label, description, value, min, max, step, displayValue, contribution, disabled, onChange }: SliderRowProps) {
  return (
    <div className={cn('py-3', disabled && 'opacity-60 pointer-events-none')}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-sm font-bold text-[var(--text)]">{displayValue}</p>
          {contribution > 0 && (
            <p className="font-mono text-xs font-semibold text-[var(--success)]">+{fmt(contribution)}</p>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[var(--navy)] h-1.5 rounded-full"
        disabled={disabled}
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{min === 0 ? fmt(min) : `${min}${label.includes('%') ? '%' : label.includes('hrs') ? ' hrs' : label.includes('weeks') ? ' wk' : ''}`}</span>
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{max}{label.includes('markup') ? '%' : label.includes('hrs') ? ' hrs' : label.includes('weeks') ? ' wk' : ''}</span>
      </div>
    </div>
  )
}

export function FinalPrice({ projectId: _projectId, trades, settings, onSettingsChange, onStageChange }: Props) {
  const navigate = useNavigate()
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localSettings, setLocalSettings] = useState<BudgetSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmLock, setConfirmLock] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const isLocked = !!localSettings.final_contract_price && !!localSettings.final_locked_at

  // Sync from parent on mount
  useEffect(() => { setLocalSettings(settings) }, [settings])

  // Debounced save
  const updateLever = (key: keyof BudgetSettings, value: number) => {
    const next = { ...localSettings, [key]: value }
    setLocalSettings(next)
    setSaved(false)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setSaving(true)
      setTimeout(() => {
        onSettingsChange(next)
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }, 300)
    }, 500)
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const s = localSettings

  const totalSubCost       = trades.filter(t => t.is_locked).reduce((sum, t) => sum + (t.awarded_amount ?? 0), 0)
  const subMarkupRevenue   = totalSubCost * s.sub_markup_percent
  const pmFee              = s.duration_weeks * s.pm_hours_per_week * s.pm_rate_per_hour
  const crewCost           = s.crew_weeks_on_site * s.crew_weekly_cost
  const crewBilled         = crewCost * s.crew_bill_multiplier
  const crewMargin         = crewBilled - crewCost
  const overheadAllocated  = (s.duration_weeks / 4.33) * s.monthly_overhead
  const contractPrice      = totalSubCost + subMarkupRevenue + crewBilled + pmFee + s.contingency_amount
  const netProfit          = subMarkupRevenue + crewMargin + pmFee + s.contingency_amount - overheadAllocated
  const netMarginPct       = contractPrice > 0 ? netProfit / contractPrice : 0
  // grossMargin available for future use if needed

  const componentsSum      = totalSubCost + subMarkupRevenue + crewBilled + pmFee + s.contingency_amount
  const balanced           = Math.abs(componentsSum - contractPrice) < 1

  // Unlocked trades
  const unlockedTrades     = trades.filter(t => !t.is_locked && t.budget_amount > 0)

  // Margin color
  const marginColor = netMarginPct >= 0.18 ? 'text-[var(--success)]' :
                      netMarginPct >= 0.12 ? 'text-[var(--warning)]' :
                                             'text-[var(--danger)]'
  const marginBg    = netMarginPct >= 0.18 ? 'bg-[var(--success)]' :
                      netMarginPct >= 0.12 ? 'bg-[var(--warning)]' :
                                             'bg-[var(--danger)]'

  // AI tip
  const aiTip = netMarginPct >= 0.18
    ? "You're priced well. Sub markup and PM fee are doing their job."
    : netMarginPct >= 0.12
    ? "Margin is tight. Try raising PM rate or bumping sub markup to 30%."
    : netProfit >= 0
    ? "This project needs attention. Sub costs are eating too much of the contract."
    : "This project loses money as priced. Sub costs exceed what the contract supports."

  const doLock = () => {
    const locked = { ...localSettings, final_contract_price: contractPrice, final_locked_at: new Date().toISOString() }
    setLocalSettings(locked)
    onSettingsChange(locked)
    setConfirmLock(false)
    navigate('/admin/proposals', { state: { final_contract_price: contractPrice, from_budget: true } })
  }

  const doUnlock = () => {
    const unlocked = { ...localSettings, final_contract_price: undefined as unknown as number, final_locked_at: undefined as unknown as string }
    setLocalSettings(unlocked)
    onSettingsChange(unlocked)
    setConfirmUnlock(false)
  }

  const displayPrice = isLocked ? (localSettings.final_contract_price ?? contractPrice) : contractPrice

  return (
    <div className="space-y-4">
      {/* Warning: unlocked trades */}
      {unlockedTrades.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-[var(--warning-bg)] rounded-2xl border border-amber-100">
          <AlertTriangle size={18} className="text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">
              {unlockedTrades.length} trade{unlockedTrades.length !== 1 ? 's' : ''} still need to be locked
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {unlockedTrades.map(t => t.name).join(', ')} — price shown is a preview only.
            </p>
          </div>
          <button
            onClick={() => onStageChange(2)}
            className="text-xs font-semibold text-[var(--warning)] flex-shrink-0 underline underline-offset-2"
          >
            View open trades
          </button>
        </div>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Sub Costs (locked)</p>
          <p className="font-mono text-lg font-bold text-[var(--text)] mt-1">{fmt(totalSubCost)}</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">From awarded quotes</p>
        </div>
        <div className="bg-[var(--success-bg)] border border-green-100 rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Sub Markup Revenue</p>
          <p className="font-mono text-lg font-bold text-[var(--success)] mt-1">+{fmt(subMarkupRevenue)}</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{(s.sub_markup_percent * 100).toFixed(0)}% markup</p>
        </div>
        <div className="bg-[var(--success-bg)] border border-green-100 rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Crew + PM Revenue</p>
          <p className="font-mono text-lg font-bold text-[var(--success)] mt-1">+{fmt(crewBilled + pmFee)}</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Crew {fmt(crewBilled)} + PM {fmt(pmFee)}</p>
        </div>
        <div className={`border rounded-2xl p-3 ${netProfit >= 0 ? 'bg-[var(--success-bg)] border-green-100' : 'bg-[var(--danger-bg)] border-red-100'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Net Profit</p>
          <p className={`font-mono text-lg font-bold mt-1 ${netProfit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {netProfit >= 0 ? '+' : ''}{fmt(netProfit)}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">After overhead</p>
        </div>
      </div>

      {/* Contract price block */}
      <div className="bg-[var(--navy)] rounded-2xl p-4">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wide mb-1">Contract Price to Client</p>
        <p className="font-mono text-4xl font-bold text-white">{fmt(displayPrice)}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={cn(
            'font-mono text-xs font-bold px-2.5 py-1 rounded-full',
            netMarginPct >= 0.18 ? 'bg-[var(--success)] text-white' :
            netMarginPct >= 0.12 ? 'bg-[var(--warning)] text-white' :
                                   'bg-[var(--danger)] text-white'
          )}>
            {fmtPct(netMarginPct)} net
          </span>
          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${marginBg}`}
              style={{ width: `${Math.min(100, netMarginPct * 100 / 0.25 * 100)}%` }}
            />
          </div>
        </div>
        <p className="text-white/50 text-[11px] mt-2">
          Overhead allocated: {fmt(overheadAllocated)} · Target: 18–22% net
        </p>
        {/* Saving indicator */}
        <div className="mt-2 h-4">
          {saving && <p className="text-white/50 text-[10px]">Saving…</p>}
          {saved && !saving && (
            <p className="text-white/50 text-[10px] flex items-center gap-1">
              <Check size={10} /> Saved
            </p>
          )}
        </div>
      </div>

      {/* Locked costs */}
      <div>
        <SectionHeader title={`Locked Costs (${trades.filter(t => t.is_locked).length} trades)`} />
        <Card padding="none">
          {trades.filter(t => t.is_locked).length === 0 ? (
            <div className="p-4 text-sm text-[var(--text-tertiary)] text-center">No locked trades yet.</div>
          ) : (
            trades.filter(t => t.is_locked).map(trade => {
              const overBudget = (trade.awarded_amount ?? 0) > trade.budget_amount
              return (
                <div key={trade.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)]">{trade.name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Budget target: {fmt(trade.budget_amount)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className={`font-mono text-sm font-bold ${overBudget ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                      {fmt(trade.awarded_amount ?? 0)}
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--cream-light)] text-[var(--text-secondary)] flex items-center gap-0.5">
                      <Lock size={8} /> Locked
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </div>

      {/* Levers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Your Levers" />
          {isLocked && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--cream-light)] text-[var(--text-secondary)]">
              Locked — read only
            </span>
          )}
        </div>
        <Card>
          <div className="divide-y divide-[var(--border-light)]">
            <SliderRow
              label="Sub markup %"
              description="Markup on all awarded sub costs"
              value={s.sub_markup_percent * 100}
              min={10}
              max={40}
              step={1}
              displayValue={`${(s.sub_markup_percent * 100).toFixed(0)}%`}
              contribution={subMarkupRevenue}
              disabled={isLocked}
              onChange={v => updateLever('sub_markup_percent', v / 100)}
            />
            <SliderRow
              label="PM hrs / week"
              description={`${s.pm_hours_per_week} hrs × ${s.duration_weeks} wks × $${s.pm_rate_per_hour}/hr`}
              value={s.pm_hours_per_week}
              min={2}
              max={20}
              step={1}
              displayValue={`${s.pm_hours_per_week} hrs/wk`}
              contribution={pmFee}
              disabled={isLocked}
              onChange={v => updateLever('pm_hours_per_week', v)}
            />
            <SliderRow
              label="Crew weeks on site"
              description={`${s.crew_weeks_on_site} wks × $${s.crew_weekly_cost.toLocaleString()}/wk × ${s.crew_bill_multiplier}x bill`}
              value={s.crew_weeks_on_site}
              min={1}
              max={10}
              step={0.5}
              displayValue={`${s.crew_weeks_on_site} wks`}
              contribution={crewBilled}
              disabled={isLocked}
              onChange={v => updateLever('crew_weeks_on_site', v)}
            />
            <SliderRow
              label="Contingency buffer"
              description="Built-in buffer for unknowns"
              value={s.contingency_amount}
              min={0}
              max={25000}
              step={500}
              displayValue={fmt(s.contingency_amount)}
              contribution={s.contingency_amount}
              disabled={isLocked}
              onChange={v => updateLever('contingency_amount', v)}
            />
          </div>
        </Card>
      </div>

      {/* Profit breakdown */}
      <div>
        <SectionHeader title="Profit Breakdown" />
        <Card>
          <div className="space-y-2">
            {[
              { label: 'Sub markup revenue',           value: subMarkupRevenue,  positive: true  },
              { label: `Crew margin (billed − payroll)`, value: crewMargin,        positive: true  },
              { label: `PM fee (${Math.round(s.pm_hours_per_week * s.duration_weeks)} total hrs × $${s.pm_rate_per_hour}/hr)`, value: pmFee, positive: true },
              { label: 'Contingency buffer',           value: s.contingency_amount, positive: true },
              { label: `Overhead allocated (${s.duration_weeks} wks)`, value: -overheadAllocated, positive: false },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center">
                <p className="text-sm text-[var(--text-secondary)]">{row.label}</p>
                <p className={`font-mono text-sm font-semibold ${row.positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {row.positive ? '+' : ''}{fmt(row.value)}
                </p>
              </div>
            ))}

            <div className="border-t border-[var(--border-light)] pt-2 mt-2">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-[var(--text)]">Net profit</p>
                <p className={`font-mono text-lg font-bold ${netProfit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {netProfit >= 0 ? '+' : ''}{fmt(netProfit)}
                </p>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-[var(--text-tertiary)]">Net margin</p>
                <p className={`font-mono text-sm font-bold ${marginColor}`}>{fmtPct(netMarginPct)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Sanity check */}
      <div className={`flex items-center gap-2.5 p-3 rounded-2xl ${balanced ? 'bg-[var(--success-bg)]' : 'bg-[var(--warning-bg)]'}`}>
        {balanced
          ? <Check size={15} className="text-[var(--success)] flex-shrink-0" />
          : <AlertTriangle size={15} className="text-[var(--warning)] flex-shrink-0" />
        }
        <p className="text-xs text-[var(--text-secondary)]">
          Sub costs + crew + PM + contingency = <span className="font-mono font-semibold">{fmt(componentsSum)}</span>
          {' '}vs. contract price <span className="font-mono font-semibold">{fmt(contractPrice)}</span>
          {balanced ? ' — balanced.' : ' — small rounding gap.'}
        </p>
      </div>

      {/* AI tip bar */}
      <div className="flex items-start gap-2.5 p-3.5 bg-[var(--navy)] rounded-2xl">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={12} className="text-white" />
        </div>
        <p className="text-white text-xs leading-relaxed">{aiTip}</p>
      </div>

      {/* Ready to send */}
      <div>
        <SectionHeader title="Ready to Send" />
        <Card>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">Contract Price</p>
              <p className="font-mono text-xl font-bold text-[var(--navy)]">{fmt(displayPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">Net Margin</p>
              <p className={`font-mono text-xl font-bold ${marginColor}`}>{fmtPct(netMarginPct)}</p>
            </div>
          </div>

          {!isLocked ? (
            <div className="space-y-2">
              <button
                onClick={() => setConfirmLock(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[var(--navy)] text-white font-semibold min-h-[44px]"
              >
                <Lock size={15} />
                Lock &amp; Generate Proposal ↗
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/admin/ai')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] font-medium min-h-[44px]"
                >
                  <TrendingUp size={13} />
                  Run a what-if ↗
                </button>
                <button
                  onClick={() => navigate('/admin/invoices')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] font-medium min-h-[44px]"
                >
                  <ArrowRight size={13} />
                  Payment schedule ↗
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-[var(--success-bg)] rounded-xl">
                <Lock size={14} className="text-[var(--success)]" />
                <p className="text-sm font-semibold text-[var(--success)]">Locked — proposal price is set</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/admin/proposals')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold min-h-[44px]"
                >
                  <ArrowRight size={13} />
                  View Proposal ↗
                </button>
                <button
                  onClick={() => setConfirmUnlock(true)}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] font-medium min-h-[44px]"
                >
                  <Unlock size={13} />
                  Unlock
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Confirm lock dialog */}
      {confirmLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmLock(false)} />
          <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <Lock size={28} className="text-[var(--navy)] mb-3" />
            <p className="font-semibold text-[var(--text)] mb-2">Lock and generate proposal?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              This sets the final contract price at <span className="font-mono font-bold">{fmt(contractPrice)}</span>.
            </p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Net margin: <span className={`font-mono font-bold ${marginColor}`}>{fmtPct(netMarginPct)}</span>.
              The levers will become read-only. You can unlock later to make corrections.
            </p>
            <div className="flex gap-2">
              <button onClick={doLock} className="flex-1 py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold min-h-[44px]">
                Lock &amp; Generate
              </button>
              <button onClick={() => setConfirmLock(false)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] min-h-[44px]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm unlock dialog */}
      {confirmUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmUnlock(false)} />
          <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <Unlock size={28} className="text-[var(--warning)] mb-3" />
            <p className="font-semibold text-[var(--text)] mb-2">Unlock final price?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              The locked contract price will be cleared. You can re-lock after making adjustments.
            </p>
            <div className="flex gap-2">
              <button onClick={doUnlock} className="flex-1 py-3 rounded-xl bg-[var(--warning)] text-white text-sm font-semibold min-h-[44px]">
                Unlock
              </button>
              <button onClick={() => setConfirmUnlock(false)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] min-h-[44px]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
