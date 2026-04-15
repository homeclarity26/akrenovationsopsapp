import { useProjectPresence, type PresenceUser } from '@/hooks/useProjectPresence'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  /** How many avatars to render inline before collapsing to a "+N" badge. */
  maxAvatars?: number
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function bgForId(id: string): string {
  // Deterministic color per user so the avatar stays stable across re-renders.
  const palette = [
    'bg-[var(--navy)]',
    'bg-[var(--rust)]',
    'bg-[var(--success)]',
    'bg-[var(--warning)]',
    'bg-purple-600',
    'bg-teal-600',
  ]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return palette[Math.abs(h) % palette.length]
}

function Avatar({ user, size = 'md' }: { user: PresenceUser; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-[11px]'
  const label = user.full_name || 'User'
  return (
    <div
      className={cn(
        dims,
        'rounded-full text-white font-semibold flex items-center justify-center ring-2 ring-white flex-shrink-0',
        !user.avatar_url && bgForId(user.user_id),
      )}
      title={`${label} — viewing now`}
      aria-label={`${label} is viewing now`}
    >
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={label}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        initials(label)
      )}
    </div>
  )
}

/**
 * Renders a small stacked-avatar cluster showing which other teammates are
 * currently viewing this project. Pulls from `useProjectPresence`; returns
 * nothing when nobody else is here (which is most of the time) so it
 * doesn't take up header space for no reason.
 */
export function ProjectPresenceBar({ projectId, maxAvatars = 4, className }: Props) {
  const others = useProjectPresence(projectId)

  if (others.length === 0) return null

  const visible = others.slice(0, maxAvatars)
  const overflow = others.length - visible.length

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      aria-live="polite"
    >
      <div className="flex -space-x-1.5">
        {visible.map(u => (
          <Avatar key={u.user_id} user={u} />
        ))}
        {overflow > 0 && (
          <div
            className="w-7 h-7 rounded-full bg-[var(--border)] text-[var(--text-secondary)] text-[10px] font-semibold flex items-center justify-center ring-2 ring-white flex-shrink-0"
            title={`${overflow} more teammate${overflow === 1 ? '' : 's'} viewing`}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden sm:inline">
        {others.length === 1 ? '1 viewing' : `${others.length} viewing`}
      </span>
    </div>
  )
}
