import { useMemo } from 'react'
import {
  Plus, Pencil, Trash2, RefreshCw, UserPlus, UserMinus,
  MessageSquare, Flag, CheckCircle2, Sparkles, Activity,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useProjectActivity, type ProjectActivityRow, type ActivityType } from '@/hooks/useProjectActivity'

interface Props {
  projectId: string
  /** Optional cap on number of visible rows. Defaults to whatever the hook returns (50). */
  limit?: number
  className?: string
}

type IconCmp = typeof Plus

const ICON_FOR_TYPE: Record<ActivityType, IconCmp> = {
  created:         Plus,
  updated:         Pencil,
  deleted:         Trash2,
  status_changed:  RefreshCw,
  assigned:        UserPlus,
  unassigned:      UserMinus,
  commented:       MessageSquare,
  flagged:         Flag,
  completed:       CheckCircle2,
  ai_suggestion:   Sparkles,
  ai_action:       Sparkles,
}

// Tailwind utility classes per activity type — keeps each row subtly
// color-coded so the feed is scannable.
const COLOR_FOR_TYPE: Record<ActivityType, string> = {
  created:         'bg-[var(--navy)]/10 text-[var(--navy)]',
  updated:         'bg-[var(--bg)] text-[var(--text-secondary)]',
  deleted:         'bg-[var(--danger-bg)] text-[var(--danger)]',
  status_changed:  'bg-[var(--bg)] text-[var(--text-secondary)]',
  assigned:        'bg-[var(--success-bg)] text-[var(--success)]',
  unassigned:      'bg-[var(--bg)] text-[var(--text-tertiary)]',
  commented:       'bg-[var(--navy)]/10 text-[var(--navy)]',
  flagged:         'bg-[var(--warning-bg)] text-[var(--warning)]',
  completed:       'bg-[var(--success-bg)] text-[var(--success)]',
  ai_suggestion:   'bg-purple-100 text-purple-700',
  ai_action:       'bg-purple-100 text-purple-700',
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))

  if (diffSec < 45) return 'just now'
  if (diffSec < 90) return '1 min ago'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  // Fall back to local date for anything older
  return new Date(iso).toLocaleDateString()
}

function actorLabel(row: ProjectActivityRow): string {
  if (row.actor_type === 'ai') return 'AI assistant'
  if (row.actor_type === 'system') return 'System'
  return row.actor?.full_name ?? 'Someone'
}

export function ProjectActivityFeed({ projectId, limit, className }: Props) {
  const { data = [], isLoading, error, refetch } = useProjectActivity(projectId, { limit })

  const rows = useMemo(() => (limit ? data.slice(0, limit) : data), [data, limit])

  if (isLoading && rows.length === 0) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Activity size={14} className="animate-pulse" />
          Loading activity…
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Couldn't load project activity.
        </p>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg"
        >
          Retry
        </button>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card className={className}>
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
          No activity yet. Edits, logs, photos, and team changes will show up here.
        </p>
      </Card>
    )
  }

  return (
    <Card padding="none" className={className}>
      <ul className="divide-y divide-[var(--border-light)]">
        {rows.map(row => {
          const Icon = ICON_FOR_TYPE[row.activity_type] ?? Activity
          const badgeClass = COLOR_FOR_TYPE[row.activity_type] ?? 'bg-[var(--bg)] text-[var(--text-secondary)]'
          return (
            <li key={row.id} className="flex items-start gap-3 p-4">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                badgeClass,
              )}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)] leading-snug">
                  <span className="font-semibold">{actorLabel(row)}</span>
                  {' '}
                  <span className="text-[var(--text-secondary)]">
                    {row.summary}
                  </span>
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {formatRelativeTime(row.created_at)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
