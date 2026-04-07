import { Card, MetricCard } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CheckCircle, Circle, Loader } from 'lucide-react'

const PHASES = [
  { name: 'Demo & Prep',        status: 'complete' as const,    pct: 100 },
  { name: 'Plumbing Rough-In',  status: 'complete' as const,    pct: 100 },
  { name: 'Board & Waterproof', status: 'complete' as const,    pct: 100 },
  { name: 'Tile & Fixtures',    status: 'active' as const,      pct: 45 },
  { name: 'Vanity & Hardware',  status: 'upcoming' as const,    pct: 0 },
  { name: 'Punch List',         status: 'upcoming' as const,    pct: 0 },
]

export function ClientProgress() {
  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      {/* Welcome */}
      <div className="bg-[var(--navy)] rounded-xl p-4">
        <p className="text-white/60 text-xs mb-1">AK Renovations</p>
        <h1 className="font-display text-white text-2xl mb-0.5">Johnson Master Bath</h1>
        <p className="text-white/60 text-sm">142 Maple Ridge Drive, Hudson</p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Complete" value="62%" subtitle="On track" />
        <MetricCard label="Est. Done" value="May 15" subtitle="14 days" />
        <MetricCard label="Contract" value="$48.5K" subtitle="Signed" />
      </div>

      {/* Phase tracker */}
      <div>
        <SectionHeader title="Project Phases" />
        <Card padding="none">
          {PHASES.map((phase, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
              <div className="flex-shrink-0">
                {phase.status === 'complete' && <CheckCircle size={20} className="text-[var(--success)]" />}
                {phase.status === 'active' && <Loader size={20} className="text-[var(--navy)] animate-spin" />}
                {phase.status === 'upcoming' && <Circle size={20} className="text-[var(--border)]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${phase.status === 'upcoming' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text)]'}`}>
                  {phase.name}
                </p>
                {phase.status === 'active' && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${phase.pct}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{phase.pct}%</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {phase.status === 'complete' && (
                  <span className="text-[11px] text-[var(--success)] font-medium">Done</span>
                )}
                {phase.status === 'upcoming' && (
                  <span className="text-[11px] text-[var(--text-tertiary)]">Upcoming</span>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Latest update */}
      <div>
        <SectionHeader title="Latest Update" />
        <Card>
          <p className="text-xs text-[var(--text-tertiary)] mb-2">April 4, 2026</p>
          <p className="text-sm text-[var(--text)] leading-relaxed">
            Tile work is underway in the shower. The floor is fully set and we're moving on to the wall tile this week.
            Everything is looking great — the large format tiles are really going to open the space up.
            We're on schedule for completion by May 15.
          </p>
        </Card>
      </div>

      {/* Contact */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Your Contractor</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--navy)] flex items-center justify-center">
            <span className="text-white font-semibold text-sm">AK</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-[var(--text)]">Adam Kilgore</p>
            <p className="text-xs text-[var(--text-secondary)]">AK Renovations · (330) 555-0100</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
