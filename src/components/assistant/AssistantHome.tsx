// AssistantHome — chat-first home screen for the field worker (Phase 1).
//
// Layout (mobile-first):
//
//   ┌──────────────── header ───────────────┐
//   │ Good morning, Jane.   ☰ history       │
//   ├───────────────────────────────────────┤
//   │ • SuggestionCards (only on empty)     │
//   │ • Chat thread (user/assistant/tool)   │
//   │   * QuickReplyChips beneath tool msgs │
//   │   * Live transcript while listening   │
//   ├───────────────────────────────────────┤
//   │ Quick: Clock-in/out · Photo · Note ·  │
//   │        More                           │
//   ├───────────────────────────────────────┤
//   │ [+] Ask me anything…  [🎤] [→]        │
//   └───────────────────────────────────────┘
//
// Voice: TAP-to-talk (not hold). Live transcript streams into chat as a
// pending user bubble, finalizing on stop. Sends to agent-tool-call.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Send, Plus, Camera, FileText, Clock as ClockIcon, MoreHorizontal, Volume2, VolumeX, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useThread } from '@/lib/assistant/useThread'
import { useSuggestions } from '@/lib/assistant/useSuggestions'
import { ChatMessage } from './ChatMessage'
import { SuggestionCards } from './SuggestionCards'
import { VoiceButton, isSpeechRecognitionAvailable } from './VoiceButton'
import type { AIMessage, SuggestionItem } from '@/lib/assistant/types'
import { supabase } from '@/lib/supabase'

const QUICK_BUTTON_LABEL: Record<string, { label: string; icon: typeof Camera }> = {
  clock_in: { label: 'Clock in', icon: ClockIcon },
  clock_out: { label: 'Clock out', icon: ClockIcon },
  photo: { label: 'Photo', icon: Camera },
  note: { label: 'Note', icon: FileText },
}

export function AssistantHome() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const thread = useThread()
  const { suggestions } = useSuggestions({ pathname })

  const [input, setInput] = useState('')
  const [pendingTranscript, setPendingTranscript] = useState('')
  const [ttsEnabled, setTtsEnabled] = useState(user?.ai_tts_enabled ?? false)
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Persist TTS toggle to profile.
  const onToggleTts = useCallback(async () => {
    const next = !ttsEnabled
    setTtsEnabled(next)
    if (user?.id) {
      await supabase.from('profiles').update({ ai_tts_enabled: next }).eq('id', user.id)
    }
  }, [ttsEnabled, user?.id])

  // Detect clocked-in status to swap quick button label between Clock in / Clock out.
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!user?.id) return
      const { data } = await supabase
        .from('time_entries')
        .select('id')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .limit(1)
        .maybeSingle()
      if (!cancelled) setIsClockedIn(!!data)
    }
    check()
    const t = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id, thread.messages.length])

  // Scroll to bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.messages.length, pendingTranscript])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    const first = (user?.full_name ?? 'there').split(' ')[0]
    return `${time}, ${first}.`
  }, [user?.full_name])

  // ── Send helpers ──
  const send = useCallback(async (text: string) => {
    if (!text.trim() || thread.isSending) return
    setInput('')
    setPendingTranscript('')
    await thread.send(text, { context: { pathname } })
  }, [thread, pathname])

  const onSubmit = useCallback(() => {
    void send(input)
  }, [input, send])

  // ── Quick action: tap-execute via direct sendMessage with imperative phrasing ──
  const fireQuickAction = useCallback(async (intent: 'clock_in' | 'clock_out' | 'photo' | 'note' | 'more') => {
    if (intent === 'more') { navigate('/employee/tools'); return }
    if (intent === 'photo') { fileInputRef.current?.click(); return }
    const phrase = intent === 'clock_in' ? 'Clock me in.' : intent === 'clock_out' ? 'Clock me out.' : 'Add a daily note.'
    void send(phrase)
  }, [send, navigate])

  // Voice handlers.
  const onTranscript = useCallback((text: string, isFinal: boolean) => {
    setPendingTranscript(isFinal ? '' : text)
  }, [])
  const onFinal = useCallback((text: string) => {
    setPendingTranscript('')
    void send(text)
  }, [send])

  // ── Quick reply / custom reply handlers from ChatMessage ──
  const onQuickReply = useCallback((value: string, label: string) => {
    // Project-pick chip pattern: "project:UUID|action:name". Re-issue the
    // same intent with the resolved project_id so Claude can complete it.
    const m = value.match(/^project:([0-9a-f-]+)\|action:(\w+)$/)
    if (m) {
      const [, project_id, action] = m
      const verbs: Record<string, string> = {
        clock_in: 'Clock me in to that project',
        clock_out: 'Clock me out',
        add_daily_log: 'Save the daily log to that project',
        take_photo: 'Save the photo to that project',
        add_shopping_item: 'Add the item to that project',
        flag_change_order: 'Flag that change for that project',
        submit_receipt: 'Save the receipt to that project',
      }
      const phrase = verbs[action] ?? `Use that project (id ${project_id})`
      void send(phrase + ` (project_id ${project_id})`)
      return
    }
    if (value === 'cancel') return
    void send(label)
  }, [send])
  const onCustomReply = useCallback((placeholder: string) => {
    if (inputRef.current) inputRef.current.placeholder = placeholder
    inputRef.current?.focus()
  }, [])

  // ── Suggestion card pick: directly fire the tool via natural-language phrase ──
  const onPickSuggestion = useCallback((s: SuggestionItem) => {
    const phrases: Record<string, string> = {
      clock_in: 'Clock me in.',
      clock_out: 'Clock me out.',
      check_shopping_list: 'Show me the shopping list.',
      add_shopping_item: 'Add an item to the shopping list.',
      my_schedule: "What's on my schedule?",
      message_admin: 'Message the admin.',
      view_my_progress: 'Show my project progress.',
      send_message_to_contractor: 'Send a message to AK Renovations.',
    }
    const phrase = phrases[s.tool] ?? s.label
    void send(phrase)
  }, [send])

  // ── Photo flow ──
  const onPhotoSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    e.target.value = ''
    // Upload first, then call take_photo via natural-language prompt with the URL.
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.-]+/gi, '_')}`
    const { data: up, error: upErr } = await supabase.storage.from('project-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
    if (upErr) {
      void send(`Couldn't upload photo: ${upErr.message}`)
      return
    }
    const { data: pub } = supabase.storage.from('project-photos').getPublicUrl(up.path)
    void send(`Save this photo to my project: ${pub.publicUrl}`)
  }, [user?.id, send])

  const showSuggestions = thread.messages.length === 0

  return (
    <div className="flex flex-col h-svh bg-[var(--bg)]">
      {/* Header */}
      <header className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-[var(--border-light)] bg-white">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Assistant</p>
          <h1 className="font-display text-lg text-[var(--navy)] leading-tight">{greeting}</h1>
        </div>
        <div className="flex items-center gap-1">
          {isSpeechRecognitionAvailable() && (
            <button
              onClick={onToggleTts}
              className="p-2 rounded-full hover:bg-gray-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label={ttsEnabled ? 'Mute voice replies' : 'Enable voice replies'}
            >
              {ttsEnabled ? <Volume2 size={16} className="text-[var(--navy)]" /> : <VolumeX size={16} className="text-[var(--text-tertiary)]" />}
            </button>
          )}
          <button
            onClick={() => navigate('/employee/tools')}
            className="p-2 rounded-full hover:bg-gray-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="More tools"
          >
            <History size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {showSuggestions && (
          <>
            <p className="text-sm text-[var(--text-secondary)] px-2">
              Tell me what you need, or pick one below.
            </p>
            <SuggestionCards suggestions={suggestions} onPick={onPickSuggestion} />
          </>
        )}

        {thread.messages.map((m: AIMessage, i: number) => (
          <ChatMessage
            key={m.id ?? i}
            message={m}
            ttsEnabled={ttsEnabled}
            onQuickReply={onQuickReply}
            onCustomReply={onCustomReply}
            autoSpeak={i === thread.messages.length - 1 && (m.role === 'assistant' || m.role === 'tool')}
          />
        ))}

        {/* Live transcript bubble while voice is recording. */}
        {pendingTranscript && (
          <div className="flex justify-end opacity-70">
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[var(--navy)]/60 text-white text-sm">
              <p className="whitespace-pre-wrap break-words">{pendingTranscript}…</p>
            </div>
          </div>
        )}

        {thread.isSending && (
          <div className="flex justify-start">
            <div className="bg-[var(--cream-light,#f5efe6)] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: '0.3s' }} />
              </span>
            </div>
          </div>
        )}

        {thread.errorMessage && !thread.blocked && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {thread.errorMessage}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Budget banner */}
      {(thread.monthly_cost_so_far / thread.monthly_cost_cap >= 0.8 || thread.blocked) && (
        <div className={cn(
          'px-3 py-2 text-xs',
          thread.blocked ? 'bg-red-50 text-red-700 border-t border-red-200' : 'bg-amber-50 text-amber-800 border-t border-amber-200',
        )}>
          {thread.blocked
            ? `Monthly AI budget reached ($${thread.monthly_cost_cap.toFixed(2)}). Tap buttons still work.`
            : `Used $${thread.monthly_cost_so_far.toFixed(2)} of $${thread.monthly_cost_cap.toFixed(2)} this month. Consider tap buttons where possible.`}
        </div>
      )}

      {/* Quick actions row */}
      <div className="px-3 pt-2 pb-1 flex gap-2 overflow-x-auto bg-white border-t border-[var(--border-light)]">
        <QuickButton
          icon={QUICK_BUTTON_LABEL[isClockedIn ? 'clock_out' : 'clock_in'].icon}
          label={QUICK_BUTTON_LABEL[isClockedIn ? 'clock_out' : 'clock_in'].label}
          onClick={() => fireQuickAction(isClockedIn ? 'clock_out' : 'clock_in')}
          disabled={thread.isSending}
        />
        <QuickButton
          icon={QUICK_BUTTON_LABEL.photo.icon}
          label={QUICK_BUTTON_LABEL.photo.label}
          onClick={() => fireQuickAction('photo')}
          disabled={thread.isSending}
        />
        <QuickButton
          icon={QUICK_BUTTON_LABEL.note.icon}
          label={QUICK_BUTTON_LABEL.note.label}
          onClick={() => fireQuickAction('note')}
          disabled={thread.isSending}
        />
        <QuickButton
          icon={MoreHorizontal}
          label="More"
          onClick={() => fireQuickAction('more')}
        />
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 flex items-center gap-2 bg-white border-t border-[var(--border-light)] safe-area-bottom">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Attach"
        >
          <Plus size={18} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !thread.isSending && onSubmit()}
          placeholder="Ask me anything…"
          disabled={thread.isSending || thread.blocked}
          className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)] min-h-[44px]"
        />

        <VoiceButton onTranscript={onTranscript} onFinal={onFinal} className="shrink-0" />

        <button
          onClick={onSubmit}
          disabled={!input.trim() || thread.isSending || thread.blocked}
          className="p-2.5 rounded-full bg-[var(--navy)] text-white disabled:opacity-40 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhotoSelected}
        className="hidden"
      />
    </div>
  )
}

function QuickButton({ icon: Icon, label, onClick, disabled }: { icon: typeof Camera; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl bg-[var(--cream-light,#f5efe6)] hover:bg-[var(--cream,#ede4d2)]',
        'min-w-[80px] shrink-0 transition-colors disabled:opacity-40',
      )}
    >
      <Icon size={18} className="text-[var(--navy)]" />
      <span className="text-[11px] font-semibold text-[var(--text)]">{label}</span>
    </button>
  )
}
