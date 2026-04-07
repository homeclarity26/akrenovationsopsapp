import { useState } from 'react'
import { Send } from 'lucide-react'

const INITIAL_MESSAGES = [
  { id: 1, sender: 'Adam', role: 'admin', text: "Hey Jeff, how's the tile going today?", time: '8:02 AM', mine: false },
  { id: 2, sender: 'Jeff', role: 'employee', text: "Going good. Shower floor is done. Starting walls after lunch.", time: '8:15 AM', mine: true },
  { id: 3, sender: 'Adam', role: 'admin', text: "Perfect. Don't forget the Schluter strip on the threshold. Client wants that detail done right.", time: '8:17 AM', mine: false },
  { id: 4, sender: 'Adam', role: 'admin', text: "Also — can you grab a few progress photos before you leave today?", time: '8:18 AM', mine: false },
]

export function MessagesPage() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')

  const send = () => {
    if (!input.trim()) return
    setMessages(m => [...m, {
      id: Date.now(),
      sender: 'Jeff',
      role: 'employee',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mine: true,
    }])
    setInput('')
  }

  return (
    <div className="flex flex-col h-[calc(100svh-7rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-light)] bg-white">
        <h1 className="font-semibold text-[var(--navy)] text-base">Team Chat</h1>
        <p className="text-xs text-[var(--text-secondary)]">Adam, Jeff, Steven</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            {!m.mine && (
              <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center text-white text-xs font-semibold mr-2 flex-shrink-0 self-end">
                {m.sender[0]}
              </div>
            )}
            <div className={`max-w-[75%] ${m.mine ? '' : ''}`}>
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
        ))}
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
