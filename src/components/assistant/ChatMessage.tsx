// ChatMessage — renders one message in the chat thread. Three roles:
//   * user → right-aligned navy bubble.
//   * assistant → left-aligned cream bubble.
//   * tool → left-aligned with a small badge ('Result' or 'Error') and an
//            optional QuickReplyChips block beneath.
//
// Voice TTS button on assistant + tool bubbles when ai_tts_enabled is on.

import { useCallback, useEffect, useState } from 'react'
import { Volume2, VolumeX, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIMessage } from '@/lib/assistant/types'
import { QuickReplyChips } from './QuickReplyChips'
import { speak, cancel as cancelSpeech, isSpeaking } from '@/lib/assistant/tts'

interface Props {
  message: AIMessage
  ttsEnabled: boolean
  onQuickReply: (value: string, label: string) => void
  onCustomReply: (placeholder: string) => void
  /** Auto-speak this message if TTS is on (only for the latest assistant/tool turn). */
  autoSpeak?: boolean
}

export function ChatMessage({ message, ttsEnabled, onQuickReply, onCustomReply, autoSpeak }: Props) {
  const [speaking, setSpeaking] = useState(false)

  const text = message.content ?? ''
  const isError = !!message.tool_result?.is_error
  const role = message.role

  const onSpeak = useCallback(() => {
    if (speaking) {
      cancelSpeech()
      setSpeaking(false)
      return
    }
    speak(text)
    setSpeaking(true)
    // Polling fallback for end-of-utterance state since the SpeechSynthesis
    // 'end' callback is unreliable on iOS.
    const t = setInterval(() => {
      if (!isSpeaking()) {
        setSpeaking(false)
        clearInterval(t)
      }
    }, 250)
  }, [text, speaking])

  // Auto-speak on first mount when enabled.
  useEffect(() => {
    if (!autoSpeak || !ttsEnabled || !text || role === 'user') return
    onSpeak()
    return () => cancelSpeech()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[var(--navy)] text-white text-sm">
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
      </div>
    )
  }

  // assistant or tool
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm',
          isError
            ? 'bg-[var(--danger-bg,#fee)] text-[var(--danger,#b91c1c)] border border-[var(--danger,#b91c1c)]/20'
            : 'bg-[var(--cream-light,#f5efe6)] text-[var(--text,#1a1a1a)]',
        )}
      >
        <div className="flex items-start gap-2">
          {isError && <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <p className="whitespace-pre-wrap break-words flex-1">{text}</p>
          {ttsEnabled && text && (
            <button
              onClick={onSpeak}
              className="shrink-0 p-1 rounded-full hover:bg-black/5"
              aria-label={speaking ? 'Stop speaking' : 'Speak'}
            >
              {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}
        </div>
      </div>
      <QuickReplyChips
        quick_replies={message.quick_replies ?? message.tool_result?.quick_replies ?? null}
        onSelect={onQuickReply}
        onCustom={onCustomReply}
      />
    </div>
  )
}
