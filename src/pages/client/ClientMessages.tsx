import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Message {
  id: string
  project_id: string
  sender_id: string
  sender_role: string
  message: string
  channel?: string
  is_read?: boolean | null
  created_at: string
}

interface SenderProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

function initials(name: string | null | undefined): string {
  if (!name) return 'C'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'C'
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (isSameDay(d, now)) {
    // Relative for today
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin} min ago`
    return `Today, ${timeStr}`
  }
  // Absolute for older
  const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${datePart}, ${timeStr}`
}

export function ClientMessages() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const { data: projectId } = useQuery({
    queryKey: ['client_project_id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('client_user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle()
      return data?.id ?? null
    },
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: true })
      return (data ?? []) as Message[]
    },
  })

  // Build sender id list for avatar/name lookup
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_id).filter(Boolean)))

  const { data: profiles = [] } = useQuery<SenderProfile[]>({
    queryKey: ['message-senders', projectId, senderIds.join(',')],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds)
      if (error) {
        console.warn('[ClientMessages] profiles error:', error.message)
        return []
      }
      return (data ?? []) as SenderProfile[]
    },
  })

  const profileMap = new Map<string, SenderProfile>()
  for (const p of profiles) profileMap.set(p.id, p)

  // Real-time subscription for incoming messages
  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`messages:${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', projectId] })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('messages').insert({
        project_id: projectId,
        sender_id: user!.id,
        sender_role: 'client',
        message: content,
        channel: 'in_app',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', projectId] })
    },
  })

  const send = () => {
    if (!input.trim() || !projectId) return
    sendMutation.mutate(input.trim())
    setInput('')
  }

  const isMine = (msg: Message) => msg.sender_id === user?.id

  return (
    <div className="flex flex-col h-[calc(100svh-8rem)] max-w-lg mx-auto">
      <div className="px-4 py-3 border-b border-[var(--border-light)]">
        <h1 className="font-display text-xl text-[var(--navy)]">Messages</h1>
        <p className="text-xs text-[var(--text-secondary)]">Your Contractor</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4">
            <MessageSquare size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="font-medium text-sm text-[var(--text)]">No messages yet</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto">Send a message to start a conversation with your contractor.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = isMine(m)
          const sender = profileMap.get(m.sender_id)
          const unread = !mine && m.is_read === false
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
              {!mine && (
                <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-white text-[11px] font-semibold overflow-hidden flex-shrink-0 self-end">
                  {sender?.avatar_url ? (
                    <img src={sender.avatar_url} alt={sender.full_name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials(sender?.full_name)}</span>
                  )}
                </div>
              )}
              <div className="max-w-[78%]">
                {unread && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--rust)] mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--rust)]" />
                    New
                  </span>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                    mine
                      ? 'bg-[var(--navy)] text-white rounded-br-sm'
                      : unread
                      ? 'bg-[var(--rust-subtle)] text-[var(--text)] rounded-bl-sm border border-[var(--rust)]/30'
                      : 'bg-gray-100 text-[var(--text)] rounded-bl-sm'
                  }`}
                >
                  {m.message}
                </div>
                <p className={`text-[10px] text-[var(--text-tertiary)] mt-1 ${mine ? 'text-right' : ''}`}>
                  {!mine && sender?.full_name ? `${sender.full_name} · ` : ''}
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-[var(--border-light)] flex gap-2">
        <input
          className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)]"
          placeholder="Send a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sendMutation.isPending}
          className="p-2.5 rounded-full bg-[var(--navy)] text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
