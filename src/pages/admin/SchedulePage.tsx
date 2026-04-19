import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MapPin, CalendarDays, Grid3x3, Sparkles, ChevronLeft, ChevronRight, X, Plus, CalendarPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const EVENT_TYPES = ['install', 'site_visit', 'inspection', 'delivery', 'meeting', 'other'] as const
type EventType = typeof EVENT_TYPES[number]

interface NewEventForm {
  title: string
  project_id: string
  start_date: string
  start_time: string
  end_time: string
  all_day: boolean
  event_type: EventType
  location: string
  description: string
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY_EVENT: NewEventForm = {
  title: '',
  project_id: '',
  start_date: todayIso(),
  start_time: '',
  end_time: '',
  all_day: false,
  event_type: 'site_visit',
  location: '',
  description: '',
}

// Compute the Monday of the week that contains `d` (local time).
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = out.getDay() // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow
  out.setDate(out.getDate() + diff)
  return out
}

// Build Mon..Fri day cells for a given Monday.
function weekDaysFrom(monday: Date): { date: string; label: string }[] {
  const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const days: { date: string; label: string }[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ date: iso, label: fmt.format(d).replace(',', '') })
  }
  return days
}

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

// Google Calendar accepts a template URL with the event pre-filled. This is the
// simplest "link to Google Calendar" path — no OAuth, no service account: user
// clicks, GCal opens in a new tab with the event ready to save on their own
// calendar. Returns null if the event doesn't have enough info to render.
function buildGoogleCalendarUrl(event: Record<string, unknown>): string | null {
  const title = String(event.title ?? '').trim()
  const startDate = String(event.start_date ?? '').trim()
  if (!title || !startDate) return null

  // GCal date format: 20260419T090000/20260419T100000 for a timed event,
  // or 20260419/20260420 for an all-day event (end is exclusive).
  const isoDate = (d: string) => d.replace(/-/g, '')
  const isoTime = (t: string) => t.replace(/:/g, '').padEnd(6, '0').slice(0, 6)

  let dates: string
  if (event.all_day) {
    const start = isoDate(startDate)
    // All-day end is exclusive — add one day.
    const endParts = startDate.split('-').map(Number)
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2] + 1)
    const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`
    dates = `${start}/${end}`
  } else {
    const startTime = event.start_time ? isoTime(String(event.start_time)) : '090000'
    const endTime = event.end_time ? isoTime(String(event.end_time)) : '100000'
    dates = `${isoDate(startDate)}T${startTime}/${isoDate(String(event.end_date ?? startDate))}T${endTime}`
  }

  const project = event.projects as Record<string, unknown> | null
  const location = String(event.location ?? project?.address ?? '')
  const details = [
    event.description ? String(event.description) : null,
    project?.title ? `Project: ${String(project.title)}` : null,
  ].filter(Boolean).join('\n\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
  })
  if (location) params.set('location', location)
  if (details) params.set('details', details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
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
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEvent, setNewEvent] = useState<NewEventForm>(EMPTY_EVENT)
  const [savingEvent, setSavingEvent] = useState(false)
  const [newEventError, setNewEventError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const WEEK_DAYS = useMemo(() => weekDaysFrom(weekStart), [weekStart])
  const weekLabel = useMemo(
    () =>
      `Week of ${weekStart.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}`,
    [weekStart],
  )

  const shiftWeek = (deltaDays: number) => {
    const next = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + deltaDays)
    setWeekStart(mondayOf(next))
  }

  const { data: scheduleEvents = [], isLoading, error, refetch } = useQuery({
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

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['schedule-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, client_name, status')
        .in('status', ['active', 'pending'])
        .order('title')
      return (data ?? []) as { id: string; title: string; client_name: string | null; status: string }[]
    },
  })

  const resetNewEvent = () => {
    setNewEvent({ ...EMPTY_EVENT, start_date: todayIso() })
    setNewEventError(null)
  }

  const handleSaveEvent = async () => {
    setNewEventError(null)
    if (!newEvent.title.trim()) { setNewEventError('Title is required'); return }
    if (!newEvent.project_id) { setNewEventError('Pick a project'); return }
    if (!newEvent.start_date) { setNewEventError('Pick a date'); return }
    if (!newEvent.all_day && newEvent.start_time && newEvent.end_time && newEvent.end_time <= newEvent.start_time) {
      setNewEventError('End time must be after start time'); return
    }
    setSavingEvent(true)
    const payload: Record<string, unknown> = {
      title: newEvent.title.trim(),
      project_id: newEvent.project_id,
      start_date: newEvent.start_date,
      event_type: newEvent.event_type,
      all_day: newEvent.all_day,
      location: newEvent.location.trim() || null,
      description: newEvent.description.trim() || null,
    }
    if (!newEvent.all_day) {
      payload.start_time = newEvent.start_time || null
      payload.end_time = newEvent.end_time || null
    }
    const { error: insertError } = await supabase.from('schedule_events').insert(payload)
    setSavingEvent(false)
    if (insertError) {
      setNewEventError(insertError.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['schedule_events'] })
    setShowNewEvent(false)
    resetNewEvent()
  }

  const groupedEvents = groupByDate(scheduleEvents)

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load schedule. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Schedule"
        subtitle={weekLabel}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={() => { resetNewEvent(); setShowNewEvent(true) }}>
              <Plus size={14} /> New event
            </Button>
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
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Tap "New event" above to schedule one.</p>
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
                      const gcalUrl = buildGoogleCalendarUrl(item)
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
                            {!!project?.title && (
                              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                                Project: {String(project.title)}
                              </p>
                            )}
                          </div>
                          {gcalUrl && (
                            <a
                              href={gcalUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Add to Google Calendar"
                              className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--navy)] border border-[var(--border)] px-2 py-1.5 rounded-lg hover:bg-[var(--bg)]"
                            >
                              <CalendarPlus size={12} />
                              Add to GCal
                            </a>
                          )}
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
              <button
                onClick={() => shiftWeek(-7)}
                aria-label="Previous week"
                className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)]"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setWeekStart(mondayOf(new Date()))}
                className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-secondary)]"
              >
                Today
              </button>
              <button
                onClick={() => shiftWeek(7)}
                aria-label="Next week"
                className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={optimizing}
              onClick={async () => {
                setOptimizing(true)
                setOptimizeResult(null)
                try {
                  const weekStart = WEEK_DAYS[0].date
                  const { data, error } = await supabase.functions.invoke('agent-schedule-optimizer', {
                    body: { week_start: weekStart },
                  })
                  if (error) throw error
                  setOptimizeResult(data?.suggestion ?? 'No suggestions returned.')
                } catch (err) {
                  setOptimizeResult('Error: ' + (err instanceof Error ? err.message : String(err)))
                } finally {
                  setOptimizing(false)
                }
              }}
            >
              <Sparkles size={13} className={optimizing ? 'animate-spin' : ''} />
              {optimizing ? 'Optimizing…' : 'Optimize this week'}
            </Button>
          </div>

          {/* AI Optimization Result */}
          {optimizeResult && (
            <Card>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  <Sparkles size={11} className="inline mr-1" />
                  AI Schedule Suggestions
                </p>
                <button onClick={() => setOptimizeResult(null)} className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text)]">
                  <X size={14} />
                </button>
              </div>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{optimizeResult}</div>
            </Card>
          )}

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

      {showNewEvent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => { setShowNewEvent(false); resetNewEvent() }}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-[var(--text)]">New event</h3>
              <button
                onClick={() => { setShowNewEvent(false); resetNewEvent() }}
                className="p-1 rounded hover:bg-gray-100 text-[var(--text-tertiary)]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Delivery, inspection, install…"
                  value={newEvent.title}
                  onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Project</label>
                <select
                  value={newEvent.project_id}
                  onChange={e => setNewEvent(f => ({ ...f, project_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white"
                >
                  <option value="">Select a project…</option>
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title}{p.client_name ? ` — ${p.client_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Event type</label>
                <select
                  value={newEvent.event_type}
                  onChange={e => setNewEvent(f => ({ ...f, event_type: e.target.value as EventType }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white"
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Date</label>
                <input
                  type="date"
                  value={newEvent.start_date}
                  onChange={e => setNewEvent(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={newEvent.all_day}
                  onChange={e => setNewEvent(f => ({ ...f, all_day: e.target.checked }))}
                />
                All day
              </label>
              {!newEvent.all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Start</label>
                    <input
                      type="time"
                      value={newEvent.start_time}
                      onChange={e => setNewEvent(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">End</label>
                    <input
                      type="time"
                      value={newEvent.end_time}
                      onChange={e => setNewEvent(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Location (optional)</label>
                <input
                  type="text"
                  placeholder="Job site address, office, etc."
                  value={newEvent.location}
                  onChange={e => setNewEvent(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={newEvent.description}
                  onChange={e => setNewEvent(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm resize-none"
                />
              </div>
              {newEventError && <p className="text-xs text-[var(--danger)]">{newEventError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setShowNewEvent(false); resetNewEvent() }}
                  disabled={savingEvent}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEvent} disabled={savingEvent}>
                  {savingEvent ? 'Saving…' : 'Save event'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
