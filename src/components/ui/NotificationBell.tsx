// NotificationBell — bell icon with unread badge + popover of recent items.
// Rendered in AdminLayout, EmployeeLayout, ClientLayout top headers.

import { useEffect, useRef, useState } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

interface NotificationBellProps {
  /** Route to send the user to when they click "View all". Pass empty string to hide. */
  viewAllHref?: string
  /** Optional extra classes for the trigger. */
  className?: string
}

export function NotificationBell({ viewAllHref = '/admin/reminders', className }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const recent = notifications.slice(0, 8)

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        className="relative p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-white transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--rust)] text-white text-[10px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white border border-[var(--border-light)] rounded-2xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
            <h3 className="font-display text-sm text-[var(--navy)]">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--navy)] flex items-center gap-1 px-1.5 py-1 rounded"
                  title="Mark all read"
                >
                  <CheckCheck size={13} /> Mark read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--navy)]"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-light)]">
                {recent.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'px-4 py-3 text-sm cursor-pointer hover:bg-[var(--bg)]',
                      !n.read_at && 'bg-[var(--cream-light)]',
                    )}
                    onClick={() => {
                      if (!n.read_at) void markRead(n.id)
                      if (n.link_url) setOpen(false)
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[var(--navy)] truncate">{n.title}</div>
                        {n.body && (
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2 whitespace-pre-wrap">
                            {n.body}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {viewAllHref && (
            <div className="px-4 py-2.5 border-t border-[var(--border-light)] text-center">
              <Link
                to={viewAllHref}
                onClick={() => setOpen(false)}
                className="text-xs text-[var(--navy)] hover:underline"
              >
                View all reminders
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
