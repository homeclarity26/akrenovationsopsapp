import { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string | number
  sender: string
  text: string
  time: string
  mine: boolean
}

export function MessagesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadMessages() {
      try {
        const { data } = await supabase
          .from('messages')
          .select('id, sender_id, sender_name, body, created_at')
          .order('created_at', { ascending: true })
          .limit(100)

        if (data && data.length > 0) {
          setMessages(data.map(m => ({
            id: m.id,
            sender: m.sender_name ?? 'Unknown',
            text: m.body ?? '',
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mine: m.sender_id === user?.id,
          })))
        }
      } catch {
        // Table may not exist yet — show empty state
      }
      setLoading(false)
    }
    loadMessages()
  }, [user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || !user) return
    const text = input.trim()
    setInput('')

    const newMsg: Message = {
      id: Date.now(),
      sender: user.full_name,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mine: true,
    }
    setMessages(m => [...m, newMsg])

    try {
      await supabase.from('messages').insert({
        sender_id: user.id,
        sender_name: user.full_name,
        body: text,
        company_id: user.company_id,
      })
    } catch {
      // Silently fail — message is shown locally
    }
  }

  return (
    <div className="flex flex-col h-[calc(100svh-7rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-light)] bg-white flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)] flex-shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-semibold text-[var(--navy)] text-base">Team Chat</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {messages.length > 0 ? `${messages.length} messages` : 'Start a conversation'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-tertiary)]">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <MessageSquare size={28} className="text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">No messages yet</p>
            <p className="text-xs text-[var(--text-tertiary)]">Send the first message to your team.</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              {!m.mine && (
                <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-white text-xs font-semibold mr-2 flex-shrink-0 self-end">
                  {m.sender[0]}
                </div>
              )}
              <div className="max-w-[75%]">
                {!m.mine && (
                  <p className="text-[10px] text-[var(--text-tertiary)] mb-1 ml-1">{m.sender}</p>
                )}
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                  m.mine
                    ? 'bg-[var(--navy)] text-white rounded-br-sm'
                    : 'bg-gray-100 text-[var(--text)] rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
                <p className={`text-[10px] text-[var(--text-tertiary)] mt-1 ${m.mine ? 'text-right mr-1' : 'ml-1'}`}>
                  {m.time}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--border-light)] bg-white flex gap-2">
        <input
          className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)]"
          placeholder="Message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="p-2.5 rounded-full bg-[var(--navy)] text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
