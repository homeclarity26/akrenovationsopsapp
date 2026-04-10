import { useState } from 'react'
import { Mic, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIBarProps {
  onClose?: () => void
  placeholder?: string
}

export function AIBar({ onClose, placeholder = 'Ask anything or give a command...' }: AIBarProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  const send = () => {
    if (!input.trim()) return
    setMessages(m => [
      ...m,
      { role: 'user', text: input },
      { role: 'ai', text: 'Got it! This feature will connect to the AI engine. For now, everything is running on mock data.' },
    ])
    setInput('')
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl max-h-[80svh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--navy)] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">AI</span>
            </div>
            <span className="font-semibold text-[var(--navy)] text-sm">TradeOffice AI</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-[var(--navy)] flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold">AI</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Ask about your projects, financials, or give a command like "Send the Johnson invoice."
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm',
                  m.role === 'user'
                    ? 'bg-[var(--navy)] text-white rounded-br-sm'
                    : 'bg-gray-100 text-[var(--text)] rounded-bl-sm'
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--border-light)] flex gap-2 items-center">
          <button className="p-2.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 transition-colors">
            <Mic size={18} />
          </button>
          <input
            className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)] transition-colors"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            autoFocus
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="p-2.5 rounded-full bg-[var(--navy)] text-white disabled:opacity-40 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
