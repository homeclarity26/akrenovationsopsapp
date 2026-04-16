import { cn } from '@/lib/utils'

// ── SkeletonText ─────────────────────────────────────────────────────────────

interface SkeletonTextProps {
  lines?: number
  className?: string
}

/** Pulsing text placeholder. `lines` defaults to 1. */
export function SkeletonText({ lines = 1, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-3 rounded bg-[var(--border)] animate-pulse',
            i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full',
          )}
        />
      ))}
    </div>
  )
}

// ── SkeletonCard ─────────────────────────────────────────────────────────────

interface SkeletonCardProps {
  className?: string
}

/** Card-shaped placeholder with title + 2 text lines. */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-light)] p-4 space-y-3',
        className,
      )}
    >
      <div className="h-4 w-1/3 rounded bg-[var(--border)] animate-pulse" />
      <div className="h-3 w-full rounded bg-[var(--border)] animate-pulse" />
      <div className="h-3 w-2/3 rounded bg-[var(--border)] animate-pulse" />
    </div>
  )
}

// ── SkeletonRow ──────────────────────────────────────────────────────────────

interface SkeletonRowProps {
  count?: number
  className?: string
}

/** Repeating row placeholders (e.g. list items). `count` defaults to 3. */
export function SkeletonRow({ count = 3, className }: SkeletonRowProps) {
  return (
    <div className={cn('divide-y divide-[var(--border-light)]', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-[var(--border)] animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-[var(--border)] rounded animate-pulse w-2/3" />
            <div className="h-3 bg-[var(--border-light)] rounded animate-pulse w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
