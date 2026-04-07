import { useState } from 'react'
import { ChevronRight, Calculator, TrendingUp, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import { MOCK_ESTIMATE_TEMPLATES, MOCK_LABOR_BENCHMARKS, MOCK_CREW_HOURLY_RATE } from '@/data/mock'
import type { EstimateTemplate, EstimateTemplateConfidence } from '@/data/mock'
import { cn } from '@/lib/utils'

function money(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const CONFIDENCE_CFG: Record<EstimateTemplateConfidence, { label: string; cls: string }> = {
  industry: { label: 'Industry', cls: 'bg-gray-100 text-[var(--text-secondary)]' },
  regional: { label: 'Regional', cls: 'bg-blue-50 text-blue-600' },
  actual: { label: 'Actual', cls: 'bg-[var(--success-bg)] text-[var(--success)]' },
}

function groupByProjectType(templates: EstimateTemplate[]) {
  const groups: Record<string, EstimateTemplate[]> = {}
  for (const t of templates) {
    if (!groups[t.project_type]) groups[t.project_type] = []
    groups[t.project_type].push(t)
  }
  return groups
}

const TYPE_LABELS: Record<string, string> = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  addition: 'Home Addition',
  basement: 'Basement Finish',
  first_floor: 'First-Floor Transformation',
  master_suite: 'Master Suite',
  full_renovation: 'Full Renovation',
  exterior: 'Exterior',
}

export function EstimateTemplatesPage() {
  const [selected, setSelected] = useState<EstimateTemplate | null>(null)
  const [innerTab, setInnerTab] = useState<'materials' | 'labor'>('materials')
  const groups = groupByProjectType(MOCK_ESTIMATE_TEMPLATES)

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Estimate Templates"
        subtitle="Calibrated cost ranges the AI uses as anchors when generating estimates."
      />

      {!selected && (
        <div className="flex gap-1 border-b border-[var(--border-light)]">
          <button
            onClick={() => setInnerTab('materials')}
            className={cn(
              'py-2.5 px-4 text-xs font-semibold border-b-2 transition-all',
              innerTab === 'materials'
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]',
            )}
          >
            Material costs
          </button>
          <button
            onClick={() => setInnerTab('labor')}
            className={cn(
              'py-2.5 px-4 text-xs font-semibold border-b-2 transition-all',
              innerTab === 'labor'
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]',
            )}
          >
            Labor benchmarks
          </button>
        </div>
      )}

      {!selected && innerTab === 'labor' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              Crew rate <span className="font-mono">${MOCK_CREW_HOURLY_RATE}/hr</span> · {MOCK_LABOR_BENCHMARKS.length} benchmarks
            </p>
            <Button size="sm">
              <Sparkles size={13} />
              Auto-calibrate
            </Button>
          </div>
          <Card padding="none">
            {MOCK_LABOR_BENCHMARKS.map((b) => {
              const costTypical = b.hours_typical * MOCK_CREW_HOURLY_RATE
              return (
                <div key={b.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 border-b border-[var(--border-light)] last:border-0 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{b.task_name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] capitalize">
                      {b.category} · {b.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-[var(--text-secondary)]">
                      {b.hours_min}–{b.hours_max} hrs
                    </p>
                    <p className="font-mono text-[11px] text-[var(--text-tertiary)]">
                      typ {b.hours_typical}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-[var(--text)]">
                      ${costTypical.toFixed(0)}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] capitalize">
                      {b.confidence_level} · {b.projects_count}p
                    </p>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>
      )}

      {!selected && innerTab === 'materials' && (
        <div className="space-y-5">
          {Object.entries(groups).map(([type, templates]) => (
            <div key={type} className="space-y-2">
              <SectionHeader title={TYPE_LABELS[type] ?? type} />
              {templates.map((t) => (
                <Card key={t.id} onClick={() => setSelected(t)} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-body font-semibold text-[15px] text-[var(--navy)]">
                        {t.name}
                      </p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-body font-medium uppercase tracking-wider',
                            CONFIDENCE_CFG[t.confidence_level].cls,
                          )}
                        >
                          {CONFIDENCE_CFG[t.confidence_level].label}
                        </span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                          {t.projects_count} projects
                        </span>
                        {t.size_range_min_sqft > 0 && (
                          <span className="text-[11px] text-[var(--text-tertiary)]">
                            {t.size_range_min_sqft}-{t.size_range_max_sqft} sqft
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-mono text-[13px] text-[var(--text)]">
                        {money(t.total_cost_min)} – {money(t.total_cost_max)}
                        <span className="text-[var(--text-tertiary)]">
                          {' '}
                          (typical {money(t.total_cost_typical)})
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        {t.duration_weeks_min}-{t.duration_weeks_max} weeks
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 mt-1" />
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-[var(--text-secondary)] font-body"
          >
            ← Back to all templates
          </button>

          <Card padding="lg">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                <Calculator className="w-5 h-5 text-[var(--navy)]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl text-[var(--navy)] leading-tight">
                  {selected.name}
                </h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                  {TYPE_LABELS[selected.project_type] ?? selected.project_type} ·{' '}
                  {selected.finish_level.replace('_', '-')}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Card padding="sm">
              <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">
                Min
              </p>
              <p className="font-mono text-base text-[var(--text)]">
                {money(selected.total_cost_min)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">
                Typical
              </p>
              <p className="font-mono text-base text-[var(--rust)]">
                {money(selected.total_cost_typical)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">
                Max
              </p>
              <p className="font-mono text-base text-[var(--text)]">
                {money(selected.total_cost_max)}
              </p>
            </Card>
          </div>

          <Card padding="md">
            <SectionHeader title="Unit costs" />
            <div className="mt-3 space-y-2">
              {Object.entries(selected.unit_costs).map(([key, uc]) => (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border-light)] last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[var(--text)] font-body font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">{uc.unit}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-[13px] text-[var(--text)]">
                      ${uc.min.toFixed(0)} – ${uc.max.toFixed(0)}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--rust)]">
                      typ ${uc.typical.toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="md">
            <SectionHeader title="Trade breakdown" />
            <div className="mt-3 space-y-2">
              {Object.entries(selected.trade_breakdown).map(([trade, tb]) => (
                <div
                  key={trade}
                  className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-light)] last:border-b-0"
                >
                  <p className="text-[13px] text-[var(--text)] font-body font-medium capitalize flex-1 min-w-0">
                    {trade.replace(/_/g, ' ')}
                  </p>
                  <p className="font-mono text-[13px] text-[var(--text)] flex-shrink-0">
                    {(tb.pct_typical * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--text-secondary)]" />
              <p className="text-[13px] text-[var(--text-secondary)] font-body">
                Calibration: {CONFIDENCE_CFG[selected.confidence_level].label} ·{' '}
                {selected.projects_count} completed projects feeding this template
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
