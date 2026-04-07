import { Calendar, Wrench, Truck, ClipboardCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'

const MILESTONES = [
  {
    id: 'm1',
    date: 'Apr 7–8',
    label: 'Tile Work',
    desc: 'Shower floor and wall tile installation',
    type: 'work',
    status: 'upcoming',
  },
  {
    id: 'm2',
    date: 'Apr 9–10',
    label: 'Grouting',
    desc: 'Grout all tile, caulk transitions',
    type: 'work',
    status: 'upcoming',
  },
  {
    id: 'm3',
    date: 'Apr 15',
    label: 'Vanity & Hardware',
    desc: 'Vanity installation, plumbing connections, hardware',
    type: 'work',
    status: 'upcoming',
  },
  {
    id: 'm4',
    date: 'Apr 18',
    label: 'Kohler Vanity Delivery',
    desc: 'Delivery to 142 Maple Ridge Drive',
    type: 'delivery',
    status: 'upcoming',
  },
  {
    id: 'm5',
    date: 'Apr 22',
    label: 'Final Inspection',
    desc: 'City of Hudson building inspection',
    type: 'inspection',
    status: 'upcoming',
  },
  {
    id: 'm6',
    date: 'May 5',
    label: 'Punch List Walk',
    desc: 'Walk through with Adam to review all items',
    type: 'inspection',
    status: 'upcoming',
  },
  {
    id: 'm7',
    date: 'May 15',
    label: 'Project Complete',
    desc: 'Target completion date',
    type: 'milestone',
    status: 'upcoming',
  },
]

const TYPE_CONFIG = {
  work:       { icon: Wrench,         color: 'text-[var(--navy)]',   bg: 'bg-[var(--cream-light)]' },
  delivery:   { icon: Truck,          color: 'text-[var(--rust)]',   bg: 'bg-[var(--rust-subtle)]' },
  inspection: { icon: ClipboardCheck, color: 'text-[var(--warning)]',bg: 'bg-[var(--warning-bg)]' },
  milestone:  { icon: Calendar,       color: 'text-[var(--success)]',bg: 'bg-[var(--success-bg)]' },
}

export function ClientSchedule() {
  return (
    <div className="p-4 space-y-5">
      <div className="p-4 bg-[var(--navy)] rounded-2xl">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Target Completion</p>
        <p className="text-white font-display text-2xl">May 15, 2026</p>
        <p className="text-white/60 text-xs mt-1">Johnson Master Bath · 62% complete</p>
      </div>

      <SectionHeader title="Upcoming Milestones" />

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[22px] top-5 bottom-5 w-px bg-[var(--border-light)]" />

        <div className="space-y-4">
          {MILESTONES.map((m) => {
            const cfg = TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG]
            const Icon = cfg?.icon ?? Calendar
            return (
              <div key={m.id} className="flex gap-4 items-start relative">
                {/* Timeline dot */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-[var(--bg)] ${cfg?.bg}`}>
                  <Icon size={16} className={cfg?.color} />
                </div>

                <Card className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[var(--text)]">{m.label}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{m.desc}</p>
                    </div>
                    <p className="text-[11px] font-mono text-[var(--text-tertiary)] flex-shrink-0">{m.date}</p>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
