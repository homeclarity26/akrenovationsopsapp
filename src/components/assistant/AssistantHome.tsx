// AssistantHome — chat-first home for the field worker.
//
// Design principles after Adam's first-look feedback:
//   * No duplicate surfaces. Every common action has ONE place to do it:
//     - Voice / text → input bar at bottom (with a prominent mic).
//     - Clock in / Photo / Note → 4 quick-action buttons above the input.
//     - Projects / List / Stock / Schedule / Messages → bottom nav (layout).
//   * Empty state is a clean greeting + at most ONE smart contextual line
//     (not a chip cloud — those duplicated the quick buttons + nav).
//   * Once a chat starts, the body becomes the conversation. No chrome
//     competing for attention.
//
// Layout reservations:
//   * EmployeeLayout fixed top header: 44px
//   * EmployeeLayout fixed bottom nav: 64px
//   * Quick-action row (fixed): ~64px above nav
//   * Input bar (fixed): ~56px above quick-action row
//   * Body padding bottom: 200px to clear all of the above

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Send, Plus, Volume2, VolumeX, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useThread } from '@/lib/assistant/useThread'
import { ChatMessage } from './ChatMessage'
import { VoiceButton } from './VoiceButton'
import type { AIMessage } from '@/lib/assistant/types'
import { supabase } from '@/lib/supabase'

// Only the input bar sits above the 64px layout nav. The old quick-action
// row was dropped because the nav itself is now the 5-button action bar
// (Home / Clock / Photo / Note / More). One row, no duplicates.
const NAV_H = 64
const INPUT_H = 56
const BOTTOM_RESERVED = NAV_H + INPUT_H + 24

interface SmartContext {
  text: string
  /** Optional inline link/action description, e.g. "Clock out". */
  action_label?: string
  action_phrase?: string  // sent to send() if action_label is tapped
}

export function AssistantHome() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const thread = useThread()

  const [input, setInput] = useState('')
  const [pendingTranscript, setPendingTranscript] = useState('')
  const [ttsEnabled, setTtsEnabled] = useState(user?.ai_tts_enabled ?? false)
  const [smartCtx, setSmartCtx] = useState<SmartContext | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onToggleTts = useCallback(async () => {
    const next = !ttsEnabled
    setTtsEnabled(next)
    if (user?.id) await supabase.from('profiles').update({ ai_tts_enabled: next }).eq('id', user.id)
  }, [ttsEnabled, user?.id])

  // Single smart-context line — at most ONE thing surfaced inline.
  // Priority: clocked-in status > shopping list count > nothing.
  useEffect(() => {
    let cancelled = false
    async function compute() {
      if (!user?.id) return
      const { data: open } = await supabase
        .from('time_entries')
        .select('id, clock_in, projects(title)')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      if (open) {
        const elapsedMin = Math.floor((Date.now() - new Date(open.clock_in).getTime()) / 60000)
        const h = Math.floor(elapsedMin / 60)
        const m = elapsedMin % 60
        const dur = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`
        const proj = (open as Record<string, unknown> & { projects?: { title?: string } }).projects?.title ?? 'a project'
        setSmartCtx({
          text: `You're clocked in to ${proj} · ${dur}`,
          action_label: 'Clock out',
          action_phrase: 'Clock me out.',
        })
        return
      }

      // Shopping list count (across user's company).
      const { count } = await supabase
        .from('shopping_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'needed')
      if (cancelled) return
      const sc = count ?? 0
      if (sc > 0) {
        setSmartCtx({
          text: `${sc} item${sc === 1 ? '' : 's'} on the shopping list`,
          action_label: 'Show me',
          action_phrase: 'Show me the shopping list.',
        })
        return
      }

      setSmartCtx(null)
    }
    compute()
    const t = setInterval(compute, 60_000)
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

  const showEmptyState = thread.messages.length === 0

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100svh - 44px - 64px)' }}>
      {/* Slim control row: small label + TTS + history. Sits under layout's top bar. */}
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
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: BOTTOM_RESERVED }}
      >
        {showEmptyState && (
          <div className="pt-12 pb-2">
            <h1 className="font-display text-[28px] leading-tight text-[var(--navy)] mb-2">
              {greeting}
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)] mb-6">
              What can I help with?
            </p>

            {/* Single smart context line — only when something is timely. No
                chip cloud. */}
            {smartCtx && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--cream-light,#f5efe6)] border border-[var(--border-light)] mb-6">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)]">{smartCtx.text}</p>
                </div>
                {smartCtx.action_label && smartCtx.action_phrase && (
                  <button
                    onClick={() => send(smartCtx.action_phrase!)}
                    className="px-3 py-1.5 rounded-full bg-[var(--navy)] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    {smartCtx.action_label}
                  </button>
                )}
              </div>
            )}

            <p className="text-[13px] text-[var(--text-tertiary)]">
              Talk or type below — or use the buttons for one-tap actions.
            </p>
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

        {/* Live transcript while recording */}
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

      {/* Budget banner — sits just above the input bar when active. */}
      {(thread.monthly_cost_so_far / thread.monthly_cost_cap >= 0.8 || thread.blocked) && (
        <div
          className={cn(
            'fixed left-0 right-0 px-3 py-2 text-xs z-30',
            thread.blocked ? 'bg-red-50 text-red-700 border-t border-red-200' : 'bg-amber-50 text-amber-800 border-t border-amber-200',
          )}
          style={{ bottom: NAV_H + INPUT_H + 8 }}
        >
          {thread.blocked
            ? `AI budget reached ($${thread.monthly_cost_cap.toFixed(2)}). Tap buttons still work.`
            : `Used $${thread.monthly_cost_so_far.toFixed(2)} of $${thread.monthly_cost_cap.toFixed(2)} this month.`}
        </div>
      )}

      {/* Input bar — sits above the 5-button layout nav. Mic is the
          primary action; attach + send are support. */}
      <div
        className="fixed left-0 right-0 px-3 py-2 flex items-center gap-2 bg-white border-t border-[var(--border-light)] z-30"
        style={{ bottom: NAV_H }}
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
        <VoiceButton onTranscript={onTranscript} onFinal={onFinal} className="shrink-0 scale-110" />
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
