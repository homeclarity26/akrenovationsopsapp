import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MapPin, ChevronRight, ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useBackNavigation } from '@/hooks/useBackNavigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function SchedulePageEmployee() {
  const goBack = useBackNavigation('/employee')
  const { user } = useAuth()
  const todayStr = new Date().toISOString().slice(0, 10)

  // Get Monday of current week
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['schedule-events-week', user?.id, weekStartStr],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('schedule_events')
        .select('*, projects(title, address)')
        .gte('start_date', weekStartStr)
        .lte('start_date', weekEndStr)
        .order('start_date', { ascending: true })
        .order('start_time', { ascending: true })
      return data ?? []
    },
  })

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load schedule. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  const todayEvents = events.filter((e: any) => e.start_date === todayStr)
  const todayFirst: any = todayEvents[0] ?? null
  const todayLabel = new Date(todayStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2 pt-2">
        <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-2xl text-[var(--navy)]">Schedule</h1>
      </div>

      {/* Today */}
      <div>
        <SectionHeader title={`Today — ${todayLabel}`} />
        {isLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
        ) : todayFirst ? (
          <Card className="bg-[var(--navy)] border-0">
            <p className="text-white font-semibold text-base mb-1">{todayFirst.projects?.title ?? todayFirst.title}</p>
            <p className="text-white/70 text-sm mb-3">{todayFirst.title}</p>
            <div className="flex items-center gap-1.5 mb-4">
              <MapPin size={13} className="text-white/50" />
              <p className="text-white/50 text-xs">{todayFirst.projects?.address ?? todayFirst.location ?? ''}</p>
            </div>
            {(todayFirst.projects?.address || todayFirst.location) && (
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(todayFirst.projects?.address ?? todayFirst.location ?? '')}`}
                className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs px-3 py-2 rounded-lg font-medium"
              >
                <MapPin size={13} />
                Get Directions
              </a>
            )}
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-[var(--text-secondary)]">Nothing scheduled.</p>
          </Card>
        )}
      </div>

      {/* This week */}
      <div>
        <SectionHeader title="This Week" />
        {events.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)]">Nothing scheduled this week.</p>
          </Card>
        ) : (
          <Card padding="none">
            {events.map((day: any) => {
              const dateObj = new Date(day.start_date + 'T12:00:00')
              const isToday = day.start_date === todayStr
              const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
              const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div
                  key={day.id}
                  className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50"
                >
                  <div className="w-12 flex-shrink-0 text-center">
                    <p className={`font-semibold text-sm ${isToday ? 'text-[var(--rust)]' : 'text-[var(--text)]'}`}>{dayLabel}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">{dateLabel}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--text)] truncate">{day.projects?.title ?? day.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{day.description ?? day.event_type ?? ''}</p>
                  </div>
                  <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
                </div>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
