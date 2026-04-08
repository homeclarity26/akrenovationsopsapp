import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MapPin, CalendarDays, Grid3x3, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const WEEK_DAYS = [
  { date: '2026-04-06', label: 'Mon Apr 6' },
  { date: '2026-04-07', label: 'Tue Apr 7' },
  { date: '2026-04-08', label: 'Wed Apr 8' },
  { date: '2026-04-09', label: 'Thu Apr 9' },
  { date: '2026-04-10', label: 'Fri Apr 10' },
]

function calcEmployeeHours(employeeId: string, events: Record<string, unknown>[]): number {
  return events
    .filter((e) => Array.isArray(e.assigned_to) && (e.assigned_to as string[]).includes(employeeId))
    .length * 8 // 8h per assignment
}

function formatEventTime(event: Record<string, unknown>): string {
  if (event.all_day) return 'All Day'
  if (event.start_time) return event.start_time as string
  return ''
}

// Group schedule events by date label
function groupByDate(events: Record<string, unknown>[]): { date: string; items: Record<string, unknown>[] }[] {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const ev of events) {
    const d = ev.start_date as string
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(ev)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }))
}

export function SchedulePage() {
  const [view, setView] = useState<'calendar' | 'crew'>('calendar')

  const { data: scheduleEvents = [], isLoading } = useQuery({
    queryKey: ['schedule_events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedule_events')
        .select('*, projects(title, address)')
        .order('start_date', { ascending: true })
      return (data ?? []) as Record<string, unknown>[]
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['profiles', 'employees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'employee')
        .eq('is_active', true)
      return (data ?? []) as Record<string, unknown>[]
    },
  })

  const groupedEvents = groupByDate(scheduleEvents)

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
          {isLoading ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
            </div>
          ) : groupedEvents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="font-medium text-sm text-[var(--text)]">No events scheduled</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Add events to see them here.</p>
            </div>
          ) : (
            groupedEvents.map((day) => {
              const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={day.date}>
                  <SectionHeader title={dateLabel} />
                  <Card padding="none">
                    {day.items.map((item) => {
                      const project = item.projects as Record<string, unknown> | null
                      return (
                        <div key={item.id as string} className="flex gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                          <div className="w-16 flex-shrink-0">
                            <p className="text-[11px] font-mono text-[var(--text-tertiary)]">{formatEventTime(item)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[var(--text)]">{String(item.title ?? '')}</p>
                            {!!item.description && (
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{String(item.description)}</p>
                            )}
                            {!!(item.location || project?.address) && (
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin size={11} className="text-[var(--text-tertiary)]" />
                                <p className="text-[11px] text-[var(--text-tertiary)]">
                                  {String(item.location ?? project?.address ?? '')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </Card>
                </div>
              )
            })
          )}
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
            {employees.length === 0 ? (
              <div className="col-span-6 text-center py-8 text-sm text-[var(--text-tertiary)]">No employees found.</div>
            ) : employees.map((emp) => {
              const totalHours = calcEmployeeHours(emp.id as string, scheduleEvents)
              const standard = 40
              const pct = Math.min(100, (totalHours / standard) * 100)
              const barColor = pct >= 100 ? 'bg-[var(--danger)]' : pct >= 80 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
              return (
                <div key={emp.id as string} className="grid grid-cols-[140px_repeat(5,1fr)] gap-px bg-[var(--border-light)] border-t border-[var(--border-light)]">
                  <div className="bg-white px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--text)]">{(emp.full_name as string).split(' ')[0]}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{totalHours}h</span>
                    </div>
                  </div>
                  {WEEK_DAYS.map((d) => {
                    const cellEvents = scheduleEvents.filter(
                      (e) => e.start_date === d.date && Array.isArray(e.assigned_to) && (e.assigned_to as string[]).includes(emp.id as string)
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
                              key={ev.id as string}
                              className="rounded p-1.5 mb-1 last:mb-0 cursor-pointer bg-[var(--cream-light)]"
                              title={ev.title as string}
                            >
                              <p className="text-[11px] font-semibold text-[var(--navy)] truncate">
                                {(ev.projects as Record<string, unknown> | null)?.title as string ?? ev.title as string}
                              </p>
                              <p className="text-[10px] font-mono text-[var(--text-tertiary)]">{ev.start_time as string}</p>
                              <p className="text-[10px] text-[var(--text-secondary)] truncate">{ev.event_type as string}</p>
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
