import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, ChevronRight, AlertCircle, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isProactive?: boolean
}

const QUICK_PROMPTS = [
  "What needs my attention today?",
  "How are we tracking this month?",
  "Which projects are at risk?",
  "What's taking the most of my time?",
]

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content: "Thompson Addition framing is 4 days behind — that's the thing to focus on today. You've also got 3 pending approvals and the Johnson proposal hasn't been viewed yet after 6 days. Want to start with the project risk or the proposal follow-up?",
  timestamp: new Date(),
  isProactive: true,
}

export function MetaAgentPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const messageText = (text ?? input).trim()
    if (!messageText || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(`${supabaseUrl}/functions/v1/meta-agent-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          message: messageText,
          session_id: sessionId,
          user_id: 'admin-1', // TODO: get from auth context
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply ?? 'I ran into an issue. Try again?',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        const fallbackMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I heard you — "${messageText}". The full AI connection will be live once the edge functions are deployed to Supabase. For now, I'm running in preview mode.`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, fallbackMsg])
      }
    } catch {
      const fallbackMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. I'll be fully operational once the Supabase edge functions are deployed.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, fallbackMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[var(--border-light)] bg-[var(--white)]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="text-xs text-[var(--text-secondary)]">3 agents running</span>
        </div>
        <button
          onClick={() => navigate('/admin/settings/approvals')}
          className="flex items-center gap-1.5 text-xs text-[var(--warning)] font-medium"
        >
          <AlertCircle size={12} />
          2 pending approvals
          <ChevronRight size={11} />
        </button>
        <button
          onClick={() => navigate('/admin/ai/improvements')}
          className="flex items-center gap-1.5 text-xs text-[var(--navy)] font-medium ml-auto"
        >
          <Layers size={12} />
          1 new improvement
          <ChevronRight size={11} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0 mt-1 mr-2.5">
                <Sparkles size={13} className="text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[var(--navy)] text-white rounded-tr-sm'
                : 'bg-[var(--white)] border border-[var(--border-light)] text-[var(--text)] rounded-tl-sm'
            }`}>
              {msg.isProactive && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">from AK Ops</p>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/50' : 'text-[var(--text-tertiary)]'}`}>
                {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0 mt-1 mr-2.5">
              <Sparkles size={13} className="text-white" />
            </div>
            <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => sendMessage(prompt)}
            className="flex-shrink-0 text-xs text-[var(--navy)] border border-[var(--navy)]/20 bg-[var(--cream-light)] px-3 py-1.5 rounded-full font-medium hover:bg-[var(--cream)] transition-colors min-h-[32px]"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border-light)] bg-[var(--white)]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your business..."
              rows={1}
              className="w-full py-3 px-4 pr-10 rounded-2xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-2xl bg-[var(--navy)] flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 text-center">&#8984;&#8629; to send</p>
      </div>
    </div>
  )
}
