// RemindersPage — list + create form for the authenticated user's reminders.
// Rendered at /admin/reminders and /employee/reminders.

import { useMemo, useState } from 'react'
import { Clock, Trash2, Check, RefreshCw, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/context/AuthContext'
import {
  useReminders,
  useScheduleReminder,
  useDismissReminder,
  useDeleteReminder,
  type ReminderRow,
} from '@/hooks/useReminders'

type RemindAtShortcut = '1h' | '3h' | 'tomorrow8' | 'custom'

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/New_York'
  }
}

function formatLocal(iso: string, tz: string | null): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: tz ?? undefined,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function shortcutToIso(s: RemindAtShortcut, custom: string): string | null {
  const now = new Date()
  if (s === '1h') {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }
  if (s === '3h') {
    return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString()
  }
  if (s === 'tomorrow8') {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
    return d.toISOString()
  }
  if (s === 'custom' && custom) {
    // `custom` is a datetime-local value (YYYY-MM-DDTHH:mm) in user local tz.
    const d = new Date(custom)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  }
  return null
}

function StatusPill({ status }: { status: ReminderRow['status'] }) {
  const map: Record<ReminderRow['status'], { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-[var(--cream-light)] text-[var(--navy)]' },
    sent: { label: 'Sent', cls: 'bg-green-100 text-green-800' },
    dismissed: { label: 'Dismissed', cls: 'bg-gray-100 text-gray-600' },
    error: { label: 'Error', cls: 'bg-red-100 text-red-800' },
    snoozed: { label: 'Snoozed', cls: 'bg-yellow-100 text-yellow-800' },
  }
  const s = map[status]
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
}

export function RemindersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: reminders = [], isLoading } = useReminders()
  const schedule = useScheduleReminder()
  const dismiss = useDismissReminder()
  const remove = useDeleteReminder()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [shortcut, setShortcut] = useState<RemindAtShortcut>('1h')
  const [customDt, setCustomDt] = useState('')
  const [recurrence, setRecurrence] = useState<'' | 'daily' | 'weekly'>('')
  const [channelEmail, setChannelEmail] = useState(true)
  const [channelInApp, setChannelInApp] = useState(true)

  const tz = browserTimezone()

  const grouped = useMemo(() => {
    const upcoming = reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed')
    const past = reminders.filter((r) => r.status === 'sent' || r.status === 'dismissed' || r.status === 'error')
    return { upcoming, past }
  }, [reminders])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.warning('Give the reminder a title')
      return
    }
    const iso = shortcutToIso(shortcut, customDt)
    if (!iso) {
      toast.warning('Pick a valid time')
      return
    }
    const channels: Array<'in_app' | 'email'> = []
    if (channelInApp) channels.push('in_app')
    if (channelEmail) channels.push('email')
    if (channels.length === 0) {
      toast.warning('Pick at least one notification channel')
      return
    }
    try {
      await schedule.mutateAsync({
        title: title.trim(),
        body: body.trim() || undefined,
        remind_at: iso,
        timezone: tz,
        recurrence: recurrence || null,
        channels,
      })
      setTitle('')
      setBody('')
      setCustomDt('')
      setRecurrence('')
      toast.success('Reminder scheduled')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule reminder')
    }
  }

  if (!user) return null

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto w-full">
      <PageHeader
        title="Reminders"
        subtitle="Schedule a one-time or recurring reminder. Ask the AI or use the form below."
      />

      {/* Create form */}
      <Card className="mb-6">
        <form onSubmit={onCreate} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Grab extra lights from the shop"
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">When</label>
              <select
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value as RemindAtShortcut)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm"
              >
                <option value="1h">In 1 hour</option>
                <option value="3h">In 3 hours</option>
                <option value="tomorrow8">Tomorrow at 8:00 AM</option>
                <option value="custom">Custom time…</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Repeat</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as '' | 'daily' | 'weekly')}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm"
              >
                <option value="">One time</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </div>
          </div>

          {shortcut === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Custom date + time ({tz})
              </label>
              <input
                type="datetime-local"
                value={customDt}
                onChange={(e) => setCustomDt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notify via</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channelInApp}
                  onChange={(e) => setChannelInApp(e.target.checked)}
                />
                In-app
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channelEmail}
                  onChange={(e) => setChannelEmail(e.target.checked)}
                />
                Email
              </label>
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" size="sm" disabled={schedule.isPending}>
              {schedule.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Scheduling…
                </>
              ) : (
                <>
                  <Clock size={14} /> Schedule reminder
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Upcoming */}
      <h3 className="font-display text-sm text-[var(--navy)] mb-2 uppercase tracking-wide">Upcoming</h3>
      {isLoading ? (
        <Card className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading…</Card>
      ) : grouped.upcoming.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[var(--text-tertiary)]">
          No upcoming reminders. Try: <em>&quot;remind me at 8am to grab lights&quot;</em> from the Agent Bar.
        </Card>
      ) : (
        <ul className="space-y-2 mb-6">
          {grouped.upcoming.map((r) => (
            <li key={r.id}>
              <Card className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--navy)] truncate">{r.title}</span>
                    <StatusPill status={r.status} />
                    {r.recurrence && (
                      <span className="text-[10px] text-[var(--text-tertiary)] uppercase">{r.recurrence}</span>
                    )}
                    {r.created_by_agent && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--navy)] bg-[var(--cream-light)] px-1.5 py-0.5 rounded-full">
                        <Sparkles size={10} /> agent
                      </span>
                    )}
                  </div>
                  {r.body && <p className="text-xs text-[var(--text-secondary)] mt-0.5 whitespace-pre-wrap">{r.body}</p>}
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {formatLocal(r.remind_at, r.timezone)} · {r.channels.join(', ')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => dismiss.mutate(r.id)}
                    className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-white"
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(r.id)}
                    className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--rust)] hover:bg-white"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Past */}
      {grouped.past.length > 0 && (
        <>
          <h3 className="font-display text-sm text-[var(--navy)] mb-2 uppercase tracking-wide">History</h3>
          <ul className="space-y-2">
            {grouped.past.slice(0, 20).map((r) => (
              <li key={r.id}>
                <Card className="p-3 flex items-start justify-between gap-3 opacity-80">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--navy)] truncate">{r.title}</span>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      {formatLocal(r.remind_at, r.timezone)}
                    </p>
                    {r.error_message && (
                      <p className="text-xs text-red-600 mt-1 truncate">{r.error_message}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(r.id)}
                    className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--rust)] hover:bg-white"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default RemindersPage
