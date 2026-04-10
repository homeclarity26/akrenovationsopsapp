import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Message {
  id: string
  project_id: string
  sender_id: string
  sender_role: string
  content: string
  message_type: string
  created_at: string
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
        content,
        message_type: 'text',
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

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[calc(100svh-8rem)] max-w-lg mx-auto">
      <div className="px-4 py-3 border-b border-[var(--border-light)]">
        <h1 className="font-display text-xl text-[var(--navy)]">Messages</h1>
        <p className="text-xs text-[var(--text-secondary)]">Your Contractor</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No messages yet.</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${isMine(m) ? 'justify-end' : 'justify-start'}`}>
            {!isMine(m) && (
              <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-white text-xs font-semibold mr-2 flex-shrink-0 self-end">
                C
              </div>
            )}
            <div className="max-w-[78%]">
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                isMine(m)
                  ? 'bg-[var(--navy)] text-white rounded-br-sm'
                  : 'bg-gray-100 text-[var(--text)] rounded-bl-sm'
              }`}>
                {m.content}
              </div>
              <p className={`text-[10px] text-[var(--text-tertiary)] mt-1 ${isMine(m) ? 'text-right' : ''}`}>
                {formatTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-[var(--border-light)] flex gap-2">
        <input
          className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)]"
          placeholder="Send a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
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
