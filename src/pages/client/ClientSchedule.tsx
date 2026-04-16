import { Calendar, Wrench, Truck, ClipboardCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { useClientProject } from '@/hooks/useClientProject'

interface ScheduleEvent {
  id: string
  title: string
  description: string | null
  event_type: string | null
  start_date: string
  end_date: string | null
}

const TYPE_CONFIG: Record<string, { icon: typeof Wrench; color: string; bg: string }> = {
  work_day:     { icon: Wrench,         color: 'text-[var(--navy)]',    bg: 'bg-[var(--cream-light)]' },
  sub_work:     { icon: Wrench,         color: 'text-[var(--navy)]',    bg: 'bg-[var(--cream-light)]' },
  delivery:     { icon: Truck,          color: 'text-[var(--rust)]',    bg: 'bg-[var(--rust-subtle)]' },
  inspection:   { icon: ClipboardCheck, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning-bg)]' },
  milestone:    { icon: Calendar,       color: 'text-[var(--success)]', bg: 'bg-[var(--success-bg)]' },
  meeting:      { icon: Calendar,       color: 'text-[var(--navy)]',    bg: 'bg-[var(--cream-light)]' },
  consultation: { icon: Calendar,       color: 'text-[var(--navy)]',    bg: 'bg-[var(--cream-light)]' },
  site_visit:   { icon: Calendar,       color: 'text-[var(--navy)]',    bg: 'bg-[var(--cream-light)]' },
  other:        { icon: Calendar,       color: 'text-[var(--text-secondary)]', bg: 'bg-gray-50' },
}

function formatRange(e: ScheduleEvent): string {
  const s = new Date(e.start_date)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!e.end_date || e.end_date === e.start_date) return fmt(s)
  const en = new Date(e.end_date)
  return `${fmt(s)}–${fmt(en)}`
}

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function groupOf(dateStr: string): 'past' | 'today' | 'upcoming' {
  const today = startOfDay(new Date())
  const when = startOfDay(new Date(dateStr))
  if (when < today) return 'past'
  if (when === today) return 'today'
  return 'upcoming'
}

export function ClientSchedule() {
  const { data: project } = useClientProject()
  const projectId = project?.id ?? null

  const { data: events = [], isLoading } = useQuery<ScheduleEvent[]>({
    queryKey: ['client-schedule', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      // schedule_events has no `visible_to_client` column — safest default is to show all
      // events for this client's project (RLS still enforces project ownership).
      const { data, error } = await supabase
        .from('schedule_events')
        .select('id, title, description, event_type, start_date, end_date')
        .eq('project_id', projectId!)
        .order('start_date', { ascending: true })
      if (error) {
        console.warn('[ClientSchedule] fetch error:', error.message)
        return []
      }
      return (data ?? []) as ScheduleEvent[]
    },
  })

  const past = events.filter((e) => groupOf(e.start_date) === 'past')
  const today = events.filter((e) => groupOf(e.start_date) === 'today')
  const upcoming = events.filter((e) => groupOf(e.start_date) === 'upcoming')

  const renderSection = (title: string, list: ScheduleEvent[]) => {
    if (list.length === 0) return null
    return (
      <div>
        <SectionHeader title={title} />
        <div className="relative">
          <div className="absolute left-[22px] top-5 bottom-5 w-px bg-[var(--border-light)]" />
          <div className="space-y-4">
            {list.map((e) => {
              const cfg = TYPE_CONFIG[e.event_type ?? 'other'] ?? TYPE_CONFIG.other
              const Icon = cfg.icon
              return (
                <div key={e.id} className="flex gap-4 items-start relative">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-[var(--bg)] ${cfg.bg}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <Card className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[var(--text)]">{e.title}</p>
                        {e.description && (
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{e.description}</p>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[var(--text-tertiary)] flex-shrink-0">{formatRange(e)}</p>
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

  return (
    <div className="p-4 space-y-5">
      {project && (
        <div className="p-4 bg-[var(--navy)] rounded-2xl">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Target Completion</p>
          <p className="text-white font-display text-2xl">
            {project.target_completion_date
              ? new Date(project.target_completion_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : 'TBD'}
          </p>
          {typeof project.percent_complete === 'number' && (
            <p className="text-white/60 text-xs mt-1">
              {project.title} · {project.percent_complete}% complete
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <Card>
          <p className="text-sm text-[var(--text-tertiary)]">Loading schedule...</p>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">
            Schedule items will appear here as your contractor plans the work.
          </p>
        </Card>
      ) : (
        <>
          {renderSection('Today', today)}
          {renderSection('Upcoming', upcoming)}
          {renderSection('Past', past)}
        </>
      )}
    </div>
  )
}
