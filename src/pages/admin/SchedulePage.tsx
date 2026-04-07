import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MapPin, CalendarDays, Grid3x3, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { MOCK_CREW_SCHEDULE, MOCK_CREW_CAPACITY, MOCK_USERS } from '@/data/mock'
import { cn } from '@/lib/utils'

const EVENTS = [
  { date: 'Mon Apr 6', items: [
    { time: '7:00 AM', project: 'Johnson Master Bath', desc: 'Tile installation – shower floor', address: '142 Maple Ridge Dr, Hudson' },
    { time: '3:00 PM', project: 'Thompson Addition', desc: 'Sub check-in – framing crew', address: '88 Crestwood Ln, Stow' },
  ]},
  { date: 'Tue Apr 7', items: [
    { time: 'All Day', project: 'Johnson Master Bath', desc: 'Tile walls – shower surround', address: '142 Maple Ridge Dr, Hudson' },
  ]},
  { date: 'Wed Apr 8', items: [
    { time: '8:00 AM', project: 'Davis Consultation', desc: 'Kitchen site walk', address: '775 Oakdale Ave, Akron' },
    { time: '1:00 PM', project: 'Johnson Master Bath', desc: 'Grouting', address: '142 Maple Ridge Dr, Hudson' },
  ]},
  { date: 'Thu Apr 9', items: [
    { time: 'All Day', project: 'Thompson Addition', desc: 'Exterior framing', address: '88 Crestwood Ln, Stow' },
  ]},
  { date: 'Fri Apr 10', items: [
    { time: 'All Day', project: 'Thompson Addition', desc: 'Roof structure', address: '88 Crestwood Ln, Stow' },
    { time: '5:00 PM', project: 'Foster Proposal', desc: 'Review call', address: 'Phone' },
  ]},
]

const WEEK_DAYS = [
  { date: '2026-04-06', label: 'Mon Apr 6' },
  { date: '2026-04-07', label: 'Tue Apr 7' },
  { date: '2026-04-08', label: 'Wed Apr 8' },
  { date: '2026-04-09', label: 'Thu Apr 9' },
  { date: '2026-04-10', label: 'Fri Apr 10' },
]

const EMPLOYEES = MOCK_USERS.filter((u) => u.role === 'employee')

function calcEmployeeHours(employeeId: string): number {
  return MOCK_CREW_SCHEDULE
    .filter((e) => e.employee_id === employeeId)
    .reduce((sum) => sum + 8, 0) // 8h per assignment for mock
}

export function SchedulePage() {
  const [view, setView] = useState<'calendar' | 'crew'>('calendar')

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Schedule"
        subtitle="Week of April 6, 2026"
        action={
          <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg p-0.5">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'calendar' ? 'bg-[var(--navy)] text-white' : 'text-[var(--text-secondary)]'
              )}
            >
              <CalendarDays size={13} />
              Calendar
            </button>
            <button
              onClick={() => setView('crew')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'crew' ? 'bg-[var(--navy)] text-white' : 'text-[var(--text-secondary)]'
              )}
            >
              <Grid3x3 size={13} />
              Crew Board
            </button>
          </div>
        }
      />

      {view === 'calendar' && (
        <div className="space-y-4">
          {EVENTS.map((day) => (
            <div key={day.date}>
              <SectionHeader title={day.date} />
              <Card padding="none">
                {day.items.map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                    <div className="w-16 flex-shrink-0">
                      <p className="text-[11px] font-mono text-[var(--text-tertiary)]">{item.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)]">{item.project}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin size={11} className="text-[var(--text-tertiary)]" />
                        <p className="text-[11px] text-[var(--text-tertiary)]">{item.address}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {view === 'crew' && (
        <div className="space-y-3">
          {/* Week navigation + AI optimize */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)]">
                <ChevronLeft size={14} />
              </button>
              <button className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-secondary)]">
                Today
              </button>
              <button className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)]">
                <ChevronRight size={14} />
              </button>
            </div>
            <Button size="sm" variant="primary">
              <Sparkles size={13} />
              Optimize this week
            </Button>
          </div>

          {/* Grid: rows = employees, columns = days */}
          <Card padding="none">
            {/* Header row */}
            <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-px bg-[var(--border-light)]">
              <div className="bg-[var(--bg)] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Crew</p>
              </div>
              {WEEK_DAYS.map((d) => (
                <div key={d.date} className="bg-[var(--bg)] px-2 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{d.label}</p>
                </div>
              ))}
            </div>

            {/* Employee rows */}
            {EMPLOYEES.map((emp) => {
              const totalHours = calcEmployeeHours(emp.id)
              const standard = MOCK_CREW_CAPACITY[emp.id] ?? 40
              const pct = Math.min(100, (totalHours / standard) * 100)
              const barColor = pct >= 100 ? 'bg-[var(--danger)]' : pct >= 80 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
              return (
                <div key={emp.id} className="grid grid-cols-[140px_repeat(5,1fr)] gap-px bg-[var(--border-light)] border-t border-[var(--border-light)]">
                  <div className="bg-white px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--text)]">{emp.full_name.split(' ')[0]}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{totalHours}h</span>
                    </div>
                  </div>
                  {WEEK_DAYS.map((d) => {
                    const cellEvents = MOCK_CREW_SCHEDULE.filter(
                      (e) => e.employee_id === emp.id && e.date === d.date
                    )
                    return (
                      <div key={d.date} className="bg-white p-1.5 min-h-[72px]">
                        {cellEvents.length === 0 ? (
                          <button className="w-full h-full min-h-[60px] border border-dashed border-[var(--border-light)] rounded text-[var(--text-tertiary)] text-base">
                            +
                          </button>
                        ) : (
                          cellEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="rounded p-1.5 mb-1 last:mb-0 cursor-pointer"
                              style={{ backgroundColor: `${ev.project_color}15`, borderLeft: `3px solid ${ev.project_color}` }}
                              title={ev.task}
                            >
                              <p className="text-[11px] font-semibold text-[var(--text)] truncate" style={{ color: ev.project_color }}>
                                {ev.project_title}
                              </p>
                              <p className="text-[10px] font-mono text-[var(--text-tertiary)]">{ev.start_time}</p>
                              <p className="text-[10px] text-[var(--text-secondary)] truncate">{ev.task}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </Card>

          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Drag a block to reassign. Tap a cell to schedule. Capacity bars warn at 80% / 100%.
          </p>
        </div>
      )}
    </div>
  )
}
