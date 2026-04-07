import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MapPin, ChevronRight } from 'lucide-react'
import { MOCK_SCHEDULE } from '@/data/mock'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function SchedulePageEmployee() {
  const today = MOCK_SCHEDULE[0]

  return (
    <div className="p-4 space-y-5">
      <h1 className="font-display text-2xl text-[var(--navy)] pt-2">Schedule</h1>

      {/* Today */}
      <div>
        <SectionHeader title="Today — Monday, April 6" />
        <Card className="bg-[var(--navy)] border-0">
          <p className="text-white font-semibold text-base mb-1">{today.project}</p>
          <p className="text-white/70 text-sm mb-3">{today.task}</p>
          <div className="flex items-center gap-1.5 mb-4">
            <MapPin size={13} className="text-white/50" />
            <p className="text-white/50 text-xs">{today.address}</p>
          </div>
          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(today.address)}`}
            className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs px-3 py-2 rounded-lg font-medium"
          >
            <MapPin size={13} />
            Get Directions
          </a>
        </Card>
      </div>

      {/* This week */}
      <div>
        <SectionHeader title="This Week" />
        <Card padding="none">
          {MOCK_SCHEDULE.map((day, i) => {
            const date = new Date(2026, 3, 6) // Apr 6 local time
            date.setDate(date.getDate() + i)
            const dayLabel = DAYS[i]
            const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

            return (
              <div
                key={day.id}
                className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50"
              >
                <div className="w-12 flex-shrink-0 text-center">
                  <p className={`font-semibold text-sm ${i === 0 ? 'text-[var(--rust)]' : 'text-[var(--text)]'}`}>{dayLabel}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{dateLabel}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--text)] truncate">{day.project}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{day.task}</p>
                </div>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}
