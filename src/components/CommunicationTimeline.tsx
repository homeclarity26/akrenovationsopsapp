import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Mail, Phone, MessageSquare, Bell, Globe, ArrowDown, ArrowUp } from 'lucide-react'

type Channel = 'email' | 'sms' | 'phone' | 'in_app' | 'portal'
type Direction = 'inbound' | 'outbound'

interface CommunicationLog {
  id: string
  channel: Channel
  direction: Direction
  subject: string | null
  body: string | null
  sender_name: string | null
  sender_identifier: string | null
  metadata: Record<string, unknown>
  action_items: Array<{ text: string; done?: boolean }>
  action_item_assignee: string | null
  logged_at: string
}

interface CommunicationTimelineProps {
  projectId?: string
  contactId?: string
}

const CHANNEL_CONFIG: Record<Channel, { icon: typeof Mail; label: string; color: string }> = {
  email: { icon: Mail, label: 'Email', color: 'text-blue-600 bg-blue-50' },
  sms: { icon: MessageSquare, label: 'Text', color: 'text-green-600 bg-green-50' },
  phone: { icon: Phone, label: 'Phone', color: 'text-amber-600 bg-amber-50' },
  in_app: { icon: Bell, label: 'In-App', color: 'text-purple-600 bg-purple-50' },
  portal: { icon: Globe, label: 'Portal', color: 'text-gray-600 bg-gray-50' },
}

const ALL_CHANNELS: Channel[] = ['email', 'sms', 'phone', 'in_app', 'portal']

export function CommunicationTimeline({ projectId, contactId }: CommunicationTimelineProps) {
  const [channelFilter, setChannelFilter] = useState<Channel | null>(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['communication-logs', projectId, contactId, channelFilter],
    queryFn: async () => {
      let query = supabase
        .from('communication_logs')
        .select('id, channel, direction, subject, body, sender_name, sender_identifier, metadata, action_items, action_item_assignee, logged_at')
        .order('logged_at', { ascending: false })
        .limit(50)

      if (projectId) query = query.eq('project_id', projectId)
      if (contactId) query = query.eq('contact_id', contactId)
      if (channelFilter) query = query.eq('channel', channelFilter)

      const { data } = await query
      return (data ?? []) as CommunicationLog[]
    },
  })

  return (
    <div className="space-y-3">
      {/* Channel filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setChannelFilter(null)}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
            !channelFilter
              ? 'bg-[var(--rust)] text-white'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]',
          )}
        >
          All
        </button>
        {ALL_CHANNELS.map((ch) => {
          const cfg = CHANNEL_CONFIG[ch]
          return (
            <button
              key={ch}
              onClick={() => setChannelFilter(channelFilter === ch ? null : ch)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                channelFilter === ch
                  ? 'bg-[var(--rust)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]',
              )}
            >
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--rust)' }}
          />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-sm text-[var(--text-tertiary)] py-8">
          No communications yet
        </p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-light)]" />

          {logs.map((log) => {
            const cfg = CHANNEL_CONFIG[log.channel]
            const Icon = cfg.icon
            const DirectionIcon = log.direction === 'inbound' ? ArrowDown : ArrowUp

            return (
              <div key={log.id} className="relative pl-10 pb-4">
                {/* Icon dot */}
                <div
                  className={cn(
                    'absolute left-1.5 w-5 h-5 rounded-full flex items-center justify-center',
                    cfg.color,
                  )}
                >
                  <Icon className="w-3 h-3" />
                </div>

                <div className="bg-white rounded-lg border border-[var(--border-light)] p-3">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <DirectionIcon
                      className={cn(
                        'w-3 h-3',
                        log.direction === 'inbound' ? 'text-blue-500' : 'text-emerald-500',
                      )}
                    />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {cfg.label} &middot;{' '}
                      {log.direction === 'inbound' ? 'Received' : 'Sent'}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                      {new Date(log.logged_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Sender */}
                  {log.sender_name && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {log.sender_name}
                      {log.sender_identifier ? ` (${log.sender_identifier})` : ''}
                    </p>
                  )}

                  {/* Subject */}
                  {log.subject && (
                    <p className="text-sm font-medium text-[var(--text)] mt-1">
                      {log.subject}
                    </p>
                  )}

                  {/* Body preview */}
                  {log.body && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {log.body}
                    </p>
                  )}

                  {/* Phone call duration */}
                  {log.channel === 'phone' && log.metadata?.duration_seconds != null && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      Duration: {Math.floor(Number(log.metadata.duration_seconds) / 60)}m{' '}
                      {Number(log.metadata.duration_seconds) % 60}s
                    </p>
                  )}

                  {/* Action items */}
                  {Array.isArray(log.action_items) && log.action_items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--border-light)]">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1">
                        Action Items
                        {log.action_item_assignee && (
                          <span className="ml-1.5 normal-case tracking-normal px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                            {log.action_item_assignee}
                          </span>
                        )}
                      </p>
                      <ul className="space-y-0.5">
                        {log.action_items.map((item, i) => (
                          <li
                            key={i}
                            className={cn(
                              'text-xs',
                              item.done
                                ? 'line-through text-[var(--text-tertiary)]'
                                : 'text-[var(--text-secondary)]',
                            )}
                          >
                            {item.done ? '✓' : '○'} {item.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
