// AssistantHome — chat-first home screen for the field worker (Phase 1 v2).
//
// Layout (mobile, sits inside EmployeeLayout):
//   * Layout owns:  fixed top header (44px), fixed bottom nav (64px).
//   * AssistantHome owns the space between, with two FIXED bars at the
//     bottom (above the nav): quick-action buttons (~64px) and input bar
//     (~64px including safe-area). Body scrolls between top header and
//     these two bars.
//
// Empty state: a compact greeting + horizontal chip row of suggestions
// (instead of a stack of one lonely card).
//
// Voice: TAP-to-talk. Live transcript streams into chat as a pending
// bubble. Wraps multi-line — no horizontal-scroll cutoff.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Send, Plus, Camera, FileText, Clock as ClockIcon, MoreHorizontal, Volume2, VolumeX, History, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useThread } from '@/lib/assistant/useThread'
import { useSuggestions } from '@/lib/assistant/useSuggestions'
import { ChatMessage } from './ChatMessage'
import { VoiceButton } from './VoiceButton'
import type { AIMessage, SuggestionItem } from '@/lib/assistant/types'
import { supabase } from '@/lib/supabase'

// EmployeeLayout's bottom nav is h-16 (64px). Our two bars (quick + input)
// stack above that. Total bottom space we reserve for body padding:
//   nav (64) + input row (~64) + quick row (~76) = ~204px on tight screens.
// Use safe value with breathing room.
const BOTTOM_RESERVED = 220 // px

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

  const onToggleTts = useCallback(async () => {
    const next = !ttsEnabled
    setTtsEnabled(next)
    if (user?.id) await supabase.from('profiles').update({ ai_tts_enabled: next }).eq('id', user.id)
  }, [ttsEnabled, user?.id])

  // Detect clocked-in status to auto-swap Clock in/out label.
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.messages.length, pendingTranscript])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    const first = (user?.full_name ?? 'there').split(' ')[0]
    return `${time}, ${first}.`
  }, [user?.full_name])

  // ── Send ──
  const send = useCallback(async (text: string) => {
    if (!text.trim() || thread.isSending) return
    setInput('')
    setPendingTranscript('')
    await thread.send(text, { context: { pathname } })
  }, [thread, pathname])
  const onSubmit = useCallback(() => { void send(input) }, [input, send])

  // ── Quick actions ──
  const fireQuickAction = useCallback((intent: 'clock_in' | 'clock_out' | 'photo' | 'note' | 'more') => {
    if (intent === 'more') { navigate('/employee/tools'); return }
    if (intent === 'photo') { fileInputRef.current?.click(); return }
    const phrase = intent === 'clock_in' ? 'Clock me in.' : intent === 'clock_out' ? 'Clock me out.' : 'Add a daily note.'
    void send(phrase)
  }, [send, navigate])

  // ── Voice ──
  const onTranscript = useCallback((text: string, isFinal: boolean) => {
    setPendingTranscript(isFinal ? '' : text)
  }, [])
  const onFinal = useCallback((text: string) => {
    setPendingTranscript('')
    void send(text)
  }, [send])

  // ── Quick reply chips from a tool result ──
  const onQuickReply = useCallback((value: string, label: string) => {
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

  // ── Suggestion-card pick → natural-language phrase to fire the tool ──
  const onPickSuggestion = useCallback((s: SuggestionItem) => {
    const phrases: Record<string, string> = {
      clock_in: 'Clock me in.',
      clock_out: 'Clock me out.',
      check_shopping_list: 'Show me the shopping list.',
      add_shopping_item: 'Add an item to the shopping list.',
      my_schedule: "What's on my schedule?",
      message_admin: 'Message the admin.',
    }
    const phrase = phrases[s.tool] ?? s.label
    void send(phrase)
  }, [send])

  // ── Photo upload → take_photo tool ──
  const onPhotoSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    e.target.value = ''
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.-]+/gi, '_')}`
    const { data: up, error: upErr } = await supabase.storage.from('project-photos').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type,
    })
    if (upErr) { void send(`Couldn't upload photo: ${upErr.message}`); return }
    const { data: pub } = supabase.storage.from('project-photos').getPublicUrl(up.path)
    void send(`Save this photo to my project: ${pub.publicUrl}`)
  }, [user?.id, send])

  // ── Always-available baseline chip set for the empty state, blended
  //     with whatever agent-suggestions returned. Covers the case where
  //     the rule engine produces 0-1 contextual hits (evening, no open
  //     items) — body still feels alive instead of one lonely card. ──
  const baselineChips: SuggestionItem[] = useMemo(() => [
    { id: 'b_clockin', icon: '⏰', label: isClockedIn ? 'Clock out' : 'Clock in', tool: isClockedIn ? 'clock_out' : 'clock_in' },
    { id: 'b_shopping', icon: '🛒', label: 'Shopping list', tool: 'check_shopping_list' },
    { id: 'b_schedule', icon: '📅', label: "What's on today?", tool: 'my_schedule' },
    { id: 'b_note', icon: '📝', label: 'Add a note', tool: 'add_daily_log' },
    { id: 'b_message', icon: '💬', label: 'Message admin', tool: 'message_admin' },
  ], [isClockedIn])

  // Merge contextual suggestions FIRST (de-duped by tool name) with baselines.
  const emptyStateChips: SuggestionItem[] = useMemo(() => {
    const seen = new Set<string>()
    const out: SuggestionItem[] = []
    for (const s of [...suggestions, ...baselineChips]) {
      if (seen.has(s.tool)) continue
      seen.add(s.tool)
      out.push(s)
      if (out.length === 6) break
    }
    return out
  }, [suggestions, baselineChips])

  const showEmptyState = thread.messages.length === 0

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100svh - 44px - 64px)' }}>
      {/* Mini control row — TTS + history. Sits flush under the layout's
          top bar. No redundant greeting eyebrow (the body greeting is the
          hero on empty state). */}
      <div className="flex items-center justify-between px-3 pt-1 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Assistant</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTts}
            className="p-1.5 rounded-full hover:bg-gray-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label={ttsEnabled ? 'Mute voice' : 'Enable voice'}
          >
            {ttsEnabled ? <Volume2 size={14} className="text-[var(--navy)]" /> : <VolumeX size={14} className="text-[var(--text-tertiary)]" />}
          </button>
          <button
            onClick={() => navigate('/employee/tools')}
            className="p-1.5 rounded-full hover:bg-gray-100 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="More tools"
          >
            <History size={14} className="text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Body */}
      <main
        className="flex-1 overflow-y-auto px-3"
        style={{ paddingBottom: BOTTOM_RESERVED }}
      >
        {showEmptyState && (
          <div className="pt-6 pb-2">
            <h1 className="font-display text-[26px] leading-tight text-[var(--navy)]">
              {greeting}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 mb-5">
              Tell me what you need, or tap one of these.
            </p>
            <div className="flex flex-wrap gap-2">
              {emptyStateChips.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPickSuggestion(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-full',
                    'bg-white border border-[var(--border-light)] hover:border-[var(--navy)]',
                    'text-sm font-medium text-[var(--text)] transition-colors',
                    'min-h-[40px]',
                  )}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            {/* Subtle hint — voice + mic */}
            <div className="mt-8 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <Sparkles size={12} />
              <span>Tap the mic to talk. Tap the buttons below for one-tap actions.</span>
            </div>
          </div>
        )}

        {/* Chat */}
        {!showEmptyState && (
          <div className="pt-3 space-y-3">
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
          </div>
        )}

        {/* Live transcript bubble while voice is recording */}
        {pendingTranscript && (
          <div className="flex justify-end mt-2 opacity-70">
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[var(--navy)]/60 text-white text-sm">
              <p className="whitespace-pre-wrap break-words">{pendingTranscript}…</p>
            </div>
          </div>
        )}

        {thread.isSending && (
          <div className="flex justify-start mt-2">
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
          <div className="px-3 py-2 mt-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {thread.errorMessage}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Budget banner — always above quick action row when active */}
      {(thread.monthly_cost_so_far / thread.monthly_cost_cap >= 0.8 || thread.blocked) && (
        <div
          className={cn(
            'fixed left-0 right-0 px-3 py-2 text-xs z-30',
            thread.blocked ? 'bg-red-50 text-red-700 border-t border-red-200' : 'bg-amber-50 text-amber-800 border-t border-amber-200',
          )}
          style={{ bottom: 64 + 64 + 64 + 8 }} // above quick + input + nav
        >
          {thread.blocked
            ? `AI budget reached ($${thread.monthly_cost_cap.toFixed(2)}). Tap buttons still work.`
            : `Used $${thread.monthly_cost_so_far.toFixed(2)} of $${thread.monthly_cost_cap.toFixed(2)} this month.`}
        </div>
      )}

      {/* Quick action row — fixed above input bar, above bottom nav */}
      <div
        className="fixed left-0 right-0 px-3 py-2 flex gap-2 overflow-x-auto bg-white border-t border-[var(--border-light)] z-30"
        style={{ bottom: 64 + 64 }} // 64 (input bar) + 64 (nav)
      >
        <QuickButton
          icon={isClockedIn ? ClockIcon : ClockIcon}
          label={isClockedIn ? 'Clock out' : 'Clock in'}
          onClick={() => fireQuickAction(isClockedIn ? 'clock_out' : 'clock_in')}
          disabled={thread.isSending}
        />
        <QuickButton icon={Camera} label="Photo" onClick={() => fireQuickAction('photo')} disabled={thread.isSending} />
        <QuickButton icon={FileText} label="Note" onClick={() => fireQuickAction('note')} disabled={thread.isSending} />
        <QuickButton icon={MoreHorizontal} label="More" onClick={() => fireQuickAction('more')} />
      </div>

      {/* Input bar — fixed above bottom nav */}
      <div
        className="fixed left-0 right-0 px-3 py-2 flex items-center gap-2 bg-white border-t border-[var(--border-light)] z-30"
        style={{ bottom: 64 }} // above the 64px nav
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
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
          className="flex-1 px-3.5 py-2 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)] min-h-[40px]"
        />
        <VoiceButton onTranscript={onTranscript} onFinal={onFinal} className="shrink-0" />
        <button
          onClick={onSubmit}
          disabled={!input.trim() || thread.isSending || thread.blocked}
          className="p-2 rounded-full bg-[var(--navy)] text-white disabled:opacity-40 min-w-[40px] min-h-[40px] flex items-center justify-center"
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
        'flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-2xl bg-[var(--cream-light,#f5efe6)] hover:bg-[var(--cream,#ede4d2)]',
        'min-w-[80px] shrink-0 transition-colors disabled:opacity-40',
      )}
    >
      <Icon size={18} className="text-[var(--navy)]" />
      <span className="text-[11px] font-semibold text-[var(--text)]">{label}</span>
    </button>
  )
}
