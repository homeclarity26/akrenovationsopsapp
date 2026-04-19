/**
 * AgentOverlay — full-screen bottom sheet.
 *
 * Sections:
 *   1. Quick actions  — context-aware chips from useContextChips
 *   2. Needs attention — pending items from usePendingItems
 *   3. Recent         — last 5 actions from useRecentActivity
 *   4. Sticky input   — [clip] [mic] [text input] [send]
 *
 * Slides up 200ms. Swipe-down to close. Back button pops.
 * Focus input on open.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, Paperclip, X, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveAuthToken } from '@/lib/authToken'
import { useAuth } from '@/context/AuthContext'
import { useContextChips } from '@/hooks/useContextChips'
import { usePendingItems } from '@/hooks/usePendingItems'
import { useRecentActivity } from '@/hooks/useRecentActivity'
import { useEntitySearch } from '@/hooks/useEntitySearch'
import { type AgentOverlayState } from '@/hooks/useAgentOverlay'
import { findCommand, searchCommands, type CommandContext } from '@/lib/commands'
import { useMode } from '@/context/ModeContext'
import { matchVoiceIntent } from '@/lib/voiceIntents'
import { VoiceInput, isSpeechRecognitionAvailable } from '@/components/ui/VoiceInput'
import { AttachmentSheet } from '@/components/ui/AttachmentSheet'
import { useLocation, useParams } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentOverlayProps {
  overlay: AgentOverlayState
}

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentOverlay({ overlay }: AgentOverlayProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const params = useParams()
  const { currentMode } = useMode()

  // Data hooks
  const chips = useContextChips()
  const pending = usePendingItems()
  const { data: recentActivity } = useRecentActivity()
  const entitySearch = useEntitySearch()

  // Local state
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Focus input on open
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Listen for agent:navigate events from commands
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      if (detail) {
        overlay.close()
        navigate(detail)
      }
    }
    window.addEventListener('agent:navigate', handler)
    return () => window.removeEventListener('agent:navigate', handler)
  }, [navigate, overlay])

  // ---- Build command context ----
  const cmdCtx = useMemo<CommandContext>(() => ({
    pathname,
    user,
    params: params as Record<string, string | undefined>,
    currentMode,
  }), [pathname, user, params, currentMode])

  // ---- Send text to meta-agent-chat ----
  const sendToAgent = useCallback(
    async (text: string) => {
      setIsLoading(true)
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
        // Pull the user's token from localStorage directly — awaiting
        // supabase.auth.getSession() can hang in a wedged hydration state
        // and prevent the fetch from ever firing.
        const { accessToken, userId } = await resolveAuthToken()
        const token = accessToken ?? supabaseKey

        const res = await fetch(`${supabaseUrl}/functions/v1/meta-agent-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            user_id: userId ?? 'admin-1',
          }),
        })

        const data = await res.json().catch(() => ({}))
        if (res.ok && data.reply) {
          // Strip any ```action {...}``` blocks from the visible reply —
          // those are machine-readable instructions that the server already
          // executed; leaking them into the chat UI looks broken.
          const cleaned = (data.reply as string).replace(/```action[\s\S]*?```/g, '').trim()
          setMessages((m) => [...m, { role: 'ai', text: cleaned || data.reply }])
        } else {
          const errorDetail = data.error ?? data.message ?? `HTTP ${res.status}`
          console.error('[AgentOverlay] Edge function error:', res.status, data)
          setMessages((m) => [...m, { role: 'ai', text: `Error: ${errorDetail}` }])
        }
      } catch (err) {
        console.error('[AgentOverlay] Network error:', err)
        setMessages((m) => [
          ...m,
          {
            role: 'ai',
            text: `Network error: ${err instanceof Error ? err.message : 'Unable to reach the AI service.'}`,
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId],
  )

  // ---- Execute a command by id ----
  const executeCommand = useCallback(
    async (commandId: string, args: Record<string, unknown> = {}) => {
      const cmd = findCommand(commandId)
      if (!cmd) return

      setMessages((m) => [...m, { role: 'user', text: cmd.label }])
      setIsLoading(true)

      try {
        const result = await cmd.execute(args, cmdCtx)
        // Special: __agent_query__ means the command wants the AI to answer
        if (result.message === '__agent_query__' && result.data?.query) {
          await sendToAgent(result.data.query as string)
          return
        }
        setMessages((m) => [...m, { role: 'ai', text: result.message }])
      } catch (err) {
        setMessages((m) => [
          ...m,
          { role: 'ai', text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [cmdCtx, sendToAgent],
  )

  // ---- Handle send (text path) ----
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    entitySearch.setQuery('')
    setMessages((m) => [...m, { role: 'user', text }])

    // 1. Check for command match
    const cmdMatches = searchCommands(text, cmdCtx)
    if (cmdMatches.length === 1) {
      setIsLoading(true)
      try {
        const result = await cmdMatches[0].execute({}, cmdCtx)
        if (result.message === '__agent_query__' && result.data?.query) {
          await sendToAgent(result.data.query as string)
          return
        }
        setMessages((m) => [...m, { role: 'ai', text: result.message }])
      } finally {
        setIsLoading(false)
      }
      return
    }

    // 2. Fall through to meta-agent
    await sendToAgent(text)
  }, [input, isLoading, cmdCtx, entitySearch, sendToAgent])

  // ---- Handle voice result ----
  const handleVoiceResult = useCallback(
    (transcript: string) => {
      // Try regex intent match first
      const intent = matchVoiceIntent(transcript)
      if (intent) {
        executeCommand(intent.commandId, intent.params)
        return
      }
      // Otherwise put transcript in input for user to review/send
      setInput(transcript)
      inputRef.current?.focus()
    },
    [executeCommand],
  )

  // ---- Handle attachment ----
  const handleAttachment = useCallback(
    (_files: FileList, optionId: string) => {
      // TODO: replace with toast
      console.log('[AgentOverlay] attachment selected:', optionId, _files.length, 'files')
      setShowAttachments(false)
      setMessages((m) => [
        ...m,
        { role: 'user', text: `[Attached ${_files.length} ${optionId}]` },
      ])
    },
    [],
  )

  // ---- Handle input change (entity search) ----
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value)
      entitySearch.setQuery(e.target.value)
    },
    [entitySearch],
  )

  const showMic = isSpeechRecognitionAvailable()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/40"
      onClick={() => overlay.close()}
    >
      {/* Sheet */}
      <div
        className="mt-auto flex flex-col bg-white rounded-t-2xl max-h-[100svh] h-full overflow-hidden"
        style={{
          transform: `translateY(${overlay.swipeOffset}px)`,
          transition: overlay.swipeOffset === 0 ? 'transform 200ms ease-out' : 'none',
          animation: 'agent-slide-up 200ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        {...overlay.swipeHandlers}
      >
        {/* ---- Handle bar + header ---- */}
        <div className="flex flex-col items-center pt-2 pb-1 border-b border-[var(--border-light)]">
          <div className="w-10 h-1 rounded-full bg-gray-300 mb-2" />
          <div className="flex items-center justify-between w-full px-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--navy)] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">AI</span>
              </div>
              <span className="font-semibold text-[var(--navy)] text-sm">Assistant</span>
            </div>
            <button
              onClick={() => overlay.close()}
              className="p-2 rounded-lg hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close assistant"
            >
              <X size={18} className="text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* ---- Scrollable body ---- */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Quick actions */}
          {chips.length > 0 && messages.length === 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                Quick actions
              </p>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => executeCommand(chip.commandId)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-full',
                      'bg-gray-100 hover:bg-gray-200 transition-colors',
                      'text-xs font-medium text-[var(--text)]',
                      'min-h-[44px]',
                    )}
                  >
                    <span>{chip.icon}</span>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Needs attention */}
          {pending.totalCount > 0 && messages.length === 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                Needs attention
                <span className="ml-1 bg-red-100 text-red-700 text-[10px] px-1.5 rounded-full">
                  {pending.totalCount}
                </span>
              </p>
              <div className="space-y-1.5">
                {pending.alerts.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 text-xs">
                    <span className="shrink-0 mt-0.5">&#9888;&#65039;</span>
                    <div className="min-w-0">
                      <p className="font-medium text-amber-900 truncate">{a.item_name}</p>
                      <p className="text-amber-700 truncate">{a.message}</p>
                    </div>
                  </div>
                ))}
                {pending.suggestions.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 text-xs">
                    <span className="shrink-0 mt-0.5">&#128161;</span>
                    <div className="min-w-0">
                      <p className="font-medium text-blue-900 truncate">{s.summary}</p>
                      <p className="text-blue-700 truncate">{s.suggestion_type}</p>
                    </div>
                  </div>
                ))}
                {pending.unreadMessages.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-green-50 text-xs">
                    <span className="shrink-0 mt-0.5">&#128172;</span>
                    <div className="min-w-0">
                      <p className="font-medium text-green-900 truncate">{m.sender_name}</p>
                      <p className="text-green-700 truncate">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {recentActivity && recentActivity.length > 0 && messages.length === 0 && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock size={12} />
                Recent
              </p>
              <div className="space-y-1">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--text)] truncate">{item.summary}</p>
                      {item.project_name && (
                        <p className="text-[var(--text-tertiary)] truncate">{item.project_name}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                      {formatRelative(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entity search results */}
          {entitySearch.results.length > 0 && (
            <div className="px-4 pt-2 pb-1 border-t border-[var(--border-light)]">
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Matching entities
              </p>
              {entitySearch.results.map((hit) => (
                <button
                  key={`${hit.type}-${hit.id}`}
                  onClick={() => {
                    setInput(hit.name)
                    entitySearch.setQuery('')
                  }}
                  className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gray-50 text-xs text-left min-h-[44px]"
                >
                  <span className="text-[var(--text-tertiary)] text-[10px] uppercase w-14 shrink-0">
                    {hit.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{hit.name}</p>
                    {hit.subtitle && (
                      <p className="text-[var(--text-tertiary)] truncate">{hit.subtitle}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          {messages.length > 0 && (
            <div className="px-4 pt-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm',
                      m.role === 'user'
                        ? 'bg-[var(--navy)] text-white rounded-br-sm'
                        : 'bg-gray-100 text-[var(--text)] rounded-bl-sm',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                    <Loader2 size={16} className="text-[var(--text-tertiary)] animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && chips.length === 0 && pending.totalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="w-12 h-12 rounded-full bg-[var(--navy)] flex items-center justify-center mb-3">
                <span className="text-white font-bold">AI</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] text-center">
                Ask about your projects, financials, or give a command.
              </p>
            </div>
          )}
        </div>

        {/* ---- Attachment sheet ---- */}
        {showAttachments && (
          <AttachmentSheet
            onSelect={handleAttachment}
            onClose={() => setShowAttachments(false)}
          />
        )}

        {/* ---- Sticky input bar ---- */}
        <div className="border-t border-[var(--border-light)] bg-white px-3 py-3 flex items-center gap-2 safe-area-bottom">
          <button
            onClick={() => setShowAttachments((v) => !v)}
            className="p-2.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          {showMic && (
            <VoiceInput onResult={handleVoiceResult} className="shrink-0" />
          )}

          <input
            ref={inputRef}
            className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--navy)] transition-colors min-h-[44px]"
            placeholder="Type a message..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-full bg-[var(--navy)] text-white disabled:opacity-40 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Slide-up keyframe */}
      <style>{`
        @keyframes agent-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
