import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import type { BudgetSettings, BudgetTrade, TradeCategory } from '@/data/mock'

// Default trades for 'addition' projects
const ADDITION_DEFAULTS: Omit<BudgetTrade, 'id' | 'project_id' | 'awarded_amount' | 'awarded_subcontractor_id' | 'is_locked' | 'locked_at' | 'notes'>[] = [
  { name: 'Excavation & site work',         trade_category: 'structural',    sort_order: 0,  budget_amount: 12000 },
  { name: 'Foundation / concrete footings', trade_category: 'structural',    sort_order: 1,  budget_amount: 22000 },
  { name: 'Framing',                        trade_category: 'structural',    sort_order: 2,  budget_amount: 38000 },
  { name: 'Roofing',                        trade_category: 'exterior',      sort_order: 3,  budget_amount: 18000 },
  { name: 'Siding',                         trade_category: 'exterior',      sort_order: 4,  budget_amount: 14000 },
  { name: 'Windows & exterior doors',       trade_category: 'exterior',      sort_order: 5,  budget_amount: 20000 },
  { name: 'Exterior deck / concrete',       trade_category: 'exterior',      sort_order: 6,  budget_amount: 15000 },
  { name: 'Exterior painting',              trade_category: 'exterior',      sort_order: 7,  budget_amount:  8000 },
  { name: 'Plumbing — rough & finish',      trade_category: 'mep',           sort_order: 8,  budget_amount: 22000 },
  { name: 'Electrical — rough & finish',    trade_category: 'mep',           sort_order: 9,  budget_amount: 18000 },
  { name: 'HVAC',                           trade_category: 'mep',           sort_order: 10, budget_amount: 16000 },
  { name: 'Drywall',                        trade_category: 'interior_subs', sort_order: 11, budget_amount: 14000 },
  { name: 'Interior painting',              trade_category: 'interior_subs', sort_order: 12, budget_amount:  9000 },
  { name: 'Flooring',                       trade_category: 'interior_subs', sort_order: 13, budget_amount: 16000 },
]

const LARGE_REMODEL_DEFAULTS = ADDITION_DEFAULTS.filter(t =>
  !['structural'].includes(t.trade_category)
)

const CATEGORY_COLORS: Record<TradeCategory, string> = {
  structural:    'bg-blue-100 text-blue-700',
  exterior:      'bg-green-100 text-green-700',
  mep:           'bg-purple-100 text-purple-700',
  interior_subs: 'bg-orange-100 text-orange-700',
  crew:          'bg-[var(--cream-light)] text-[var(--navy)]',
  other:         'bg-gray-100 text-gray-600',
}

interface EditableTrade {
  localId: string
  name: string
  trade_category: TradeCategory
  budget_amount: number
}

interface Props {
  projectId: string
  projectType: string
  existingSettings?: BudgetSettings
  existingTrades?: BudgetTrade[]
  onSave: (settings: Partial<BudgetSettings>, trades: EditableTrade[]) => void
}

const DEFAULT_VARS = {
  duration_weeks: 18,
  pm_rate_per_hour: 120,
  pm_hours_per_week: 10,
  monthly_overhead: 5000,
  crew_weekly_cost: 3300,
  sub_markup_percent: 25,
}

function numInput(value: number, onChange: (v: number) => void, prefix?: string, suffix?: string) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">{prefix}</span>}
      <input
        type="number"
        className={`w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-mono bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'}`}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">{suffix}</span>}
    </div>
  )
}

export function BudgetSetup({ projectId: _projectId, projectType, existingSettings, existingTrades, onSave }: Props) {
  const defaults = projectType === 'large_remodel' ? LARGE_REMODEL_DEFAULTS : ADDITION_DEFAULTS

  const [vars, setVars] = useState({
    duration_weeks:       existingSettings?.duration_weeks       ?? DEFAULT_VARS.duration_weeks,
    pm_rate_per_hour:     existingSettings?.pm_rate_per_hour     ?? DEFAULT_VARS.pm_rate_per_hour,
    pm_hours_per_week:    existingSettings?.pm_hours_per_week    ?? DEFAULT_VARS.pm_hours_per_week,
    monthly_overhead:     existingSettings?.monthly_overhead     ?? DEFAULT_VARS.monthly_overhead,
    crew_weekly_cost:     existingSettings?.crew_weekly_cost     ?? DEFAULT_VARS.crew_weekly_cost,
    sub_markup_percent:   existingSettings ? existingSettings.sub_markup_percent * 100 : DEFAULT_VARS.sub_markup_percent,
  })

  const [trades, setTrades] = useState<EditableTrade[]>(() => {
    if (existingTrades && existingTrades.length > 0) {
      return existingTrades.map(t => ({
        localId:        t.id,
        name:           t.name,
        trade_category: t.trade_category,
        budget_amount:  t.budget_amount,
      }))
    }
    return defaults.map((d, i) => ({
      localId:        `new-${i}`,
      name:           d.name,
      trade_category: d.trade_category,
      budget_amount:  d.budget_amount,
    }))
  })

  const updateTrade = (localId: string, field: keyof EditableTrade, value: string | number) => {
    setTrades(prev => prev.map(t => t.localId === localId ? { ...t, [field]: value } : t))
  }

  const deleteTrade = (localId: string) => {
    setTrades(prev => prev.filter(t => t.localId !== localId))
  }

  const addTrade = () => {
    setTrades(prev => [...prev, {
      localId: `new-${Date.now()}`,
      name: 'New trade',
      trade_category: 'other',
      budget_amount: 0,
    }])
  }

  const totalBudget = trades.reduce((s, t) => s + (t.budget_amount || 0), 0)

  const handleSave = () => {
    onSave({
      duration_weeks:      vars.duration_weeks,
      pm_rate_per_hour:    vars.pm_rate_per_hour,
      pm_hours_per_week:   vars.pm_hours_per_week,
      monthly_overhead:    vars.monthly_overhead,
      crew_weekly_cost:    vars.crew_weekly_cost,
      sub_markup_percent:  vars.sub_markup_percent / 100,
    }, trades)
  }

  const setVar = (key: keyof typeof vars, value: number) =>
    setVars(prev => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-4">
      {/* Project variables */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">Project Variables</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">Duration (weeks)</label>
            {numInput(vars.duration_weeks, v => setVar('duration_weeks', v))}
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">PM rate ($/hr)</label>
            {numInput(vars.pm_rate_per_hour, v => setVar('pm_rate_per_hour', v), '$')}
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">PM hrs/week</label>
            {numInput(vars.pm_hours_per_week, v => setVar('pm_hours_per_week', v))}
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">Monthly overhead</label>
            {numInput(vars.monthly_overhead, v => setVar('monthly_overhead', v), '$')}
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">Crew cost/week</label>
            {numInput(vars.crew_weekly_cost, v => setVar('crew_weekly_cost', v), '$')}
          </div>
          <div>
            <label className="text-xs text-[var(--text-tertiary)] block mb-1">Sub markup</label>
            {numInput(vars.sub_markup_percent, v => setVar('sub_markup_percent', v), undefined, '%')}
          </div>
        </div>
      </Card>

      {/* Trade categories */}
      <div>
        <SectionHeader
          title={`Trade Categories (${trades.length})`}
          action={
            <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
              Total: ${totalBudget.toLocaleString()}
            </span>
          }
        />
        <Card padding="none">
          {trades.map(trade => (
            <div key={trade.localId} className="flex items-center gap-2 p-3 border-b border-[var(--border-light)] last:border-0">
              <GripVertical size={14} className="text-[var(--border)] flex-shrink-0" />

              {/* Name */}
              <input
                className="flex-1 min-w-0 py-1.5 px-2 text-sm rounded-lg border border-transparent hover:border-[var(--border)] focus:border-[var(--navy)] focus:outline-none bg-transparent text-[var(--text)]"
                value={trade.name}
                onChange={e => updateTrade(trade.localId, 'name', e.target.value)}
              />

              {/* Category badge */}
              <select
                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border-0 outline-none flex-shrink-0 ${CATEGORY_COLORS[trade.trade_category]}`}
                value={trade.trade_category}
                onChange={e => updateTrade(trade.localId, 'trade_category', e.target.value as TradeCategory)}
              >
                <option value="structural">Structural</option>
                <option value="exterior">Exterior</option>
                <option value="mep">MEP</option>
                <option value="interior_subs">Interior</option>
                <option value="crew">Crew</option>
                <option value="other">Other</option>
              </select>

              {/* Budget amount */}
              <div className="relative w-28 flex-shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)]">$</span>
                <input
                  type="number"
                  className="w-full pl-5 pr-2 py-1.5 text-sm font-mono rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                  value={trade.budget_amount}
                  onChange={e => updateTrade(trade.localId, 'budget_amount', Number(e.target.value))}
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteTrade(trade.localId)}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Add trade */}
          <button
            onClick={addTrade}
            className="flex items-center gap-2 p-3.5 w-full text-left text-sm text-[var(--navy)] font-medium hover:bg-[var(--bg)] transition-colors"
          >
            <Plus size={15} />
            Add trade
          </button>
        </Card>
      </div>

      <Button fullWidth onClick={handleSave}>
        Save &amp; Start Collecting Quotes
      </Button>
    </div>
  )
}
