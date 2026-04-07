import { useState } from 'react'
import { Send } from 'lucide-react'

const INITIAL = [
  { id: 1, sender: 'Adam', mine: false, text: "Hi! Just wanted to let you know tile is going great today. Shower floor is fully set and curing overnight. We'll start walls tomorrow morning.", time: 'Apr 5, 4:12 PM' },
  { id: 2, sender: 'You', mine: true, text: "That's exciting! Can we see some photos when you have a chance?", time: 'Apr 5, 4:45 PM' },
  { id: 3, sender: 'Adam', mine: false, text: "Absolutely! I posted a few in the Photos tab. More to come tomorrow.", time: 'Apr 5, 4:51 PM' },
]

export function ClientMessages() {
  const [messages, setMessages] = useState(INITIAL)
  const [input, setInput] = useState('')

  const send = () => {
    if (!input.trim()) return
    setMessages(m => [...m, {
      id: Date.now(),
      sender: 'You',
      mine: true,
      text: input,
      time: 'Just now',
    }])
    setInput('')
  }

  return (
    <div className="flex flex-col h-[calc(100svh-8rem)] max-w-lg mx-auto">
      <div className="px-4 py-3 border-b border-[var(--border-light)]">
        <h1 className="font-display text-xl text-[var(--navy)]">Messages</h1>
        <p className="text-xs text-[var(--text-secondary)]">AK Renovations Team</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            {!m.mine && (
              <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-white text-xs font-semibold mr-2 flex-shrink-0 self-end">
                AK
              </div>
            )}
            <div className="max-w-[78%]">
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                m.mine
                  ? 'bg-[var(--navy)] text-white rounded-br-sm'
                  : 'bg-gray-100 text-[var(--text)] rounded-bl-sm'
              }`}>
                {m.text}
              </div>
              <p className={`text-[10px] text-[var(--text-tertiary)] mt-1 ${m.mine ? 'text-right' : ''}`}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border-light)] flex gap-2">
        <input
          className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)]"
          placeholder="Message AK Renovations..."
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
