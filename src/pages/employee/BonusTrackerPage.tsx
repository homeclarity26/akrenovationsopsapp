import { Check, X, TrendingUp } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MOCK_BONUS } from '@/data/mock'

export function BonusTrackerPage() {
  const { ytd_earned, ytd_qualified, ytd_projects, hit_rate, records } = MOCK_BONUS

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl text-[var(--navy)]">Bonus Tracker</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">YTD through April 2026</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Earned YTD"
          value={`$${ytd_earned.toLocaleString()}`}
          subtitle={`${ytd_qualified} of ${ytd_projects} projects`}
        />
        <MetricCard
          label="Hit Rate"
          value={`${(hit_rate * 100).toFixed(0)}%`}
          subtitle="Schedule + margin"
        />
      </div>

      {/* How it works */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">How Bonuses Work</p>
        <div className="space-y-2">
          {[
            { label: 'Bathroom / Small Kitchen', amount: '$900' },
            { label: 'Full Kitchen / Basement',  amount: '$600' },
            { label: 'Addition / Large Project', amount: '$350' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">{row.label}</p>
              <p className="font-mono text-sm font-semibold text-[var(--text)]">{row.amount}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-tertiary)]">
            Both conditions must be met: finish on or before target date, and project margin must hit 38% or better.
          </p>
        </div>
      </Card>

      {/* Hit rate bar */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Overall Hit Rate</p>
          <TrendingUp size={15} className="text-[var(--success)]" />
        </div>
        <div className="h-3 bg-[var(--border-light)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--success)] rounded-full"
            style={{ width: `${hit_rate * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <p className="text-[11px] text-[var(--text-tertiary)]">0%</p>
          <p className="text-[11px] font-mono font-semibold text-[var(--success)]">{(hit_rate * 100).toFixed(0)}%</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">100%</p>
        </div>
      </Card>

      {/* Project records */}
      <div>
        <SectionHeader title="Project Breakdown" />
        <Card padding="none">
          {records.map((r, i) => (
            <div key={i} className="p-4 border-b border-[var(--border-light)] last:border-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{r.project}</p>
                  <p className="text-xs text-[var(--text-tertiary)] capitalize">{r.project_type}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {r.qualified ? (
                    <>
                      <Check size={14} className="text-[var(--success)]" />
                      <span className="font-mono text-sm font-bold text-[var(--success)]">${r.amount}</span>
                    </>
                  ) : (
                    <>
                      <X size={14} className="text-[var(--danger)]" />
                      <span className="text-sm font-semibold text-[var(--text-tertiary)]">Not earned</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Schedule */}
                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${r.schedule_hit ? 'bg-[var(--success-bg)]' : 'bg-[var(--danger-bg)]'}`}>
                  {r.schedule_hit
                    ? <Check size={13} className="text-[var(--success)] flex-shrink-0" />
                    : <X size={13} className="text-[var(--danger)] flex-shrink-0" />
                  }
                  <div>
                    <p className={`text-[11px] font-semibold ${r.schedule_hit ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>Schedule</p>
                    <p className={`text-[10px] ${r.schedule_hit ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{r.schedule_hit ? 'On time' : 'Behind'}</p>
                  </div>
                </div>
                {/* Margin */}
                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${r.margin_hit ? 'bg-[var(--success-bg)]' : 'bg-[var(--danger-bg)]'}`}>
                  {r.margin_hit
                    ? <Check size={13} className="text-[var(--success)] flex-shrink-0" />
                    : <X size={13} className="text-[var(--danger)] flex-shrink-0" />
                  }
                  <div>
                    <p className={`text-[11px] font-semibold ${r.margin_hit ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>Margin</p>
                    <p className={`text-[10px] font-mono ${r.margin_hit ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{r.margin}% / {r.target}%</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
