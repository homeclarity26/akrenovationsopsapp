// VoiceButton — TAP-to-talk (not hold). Streams the live transcript into
// chat via onTranscript so the user can see what the system heard. Wraps
// (no horizontal-scroll truncation — that was the bug Adam hit).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

// SpeechRecognition shim — TS doesn't know about webkitSpeechRecognition.
type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : unknown
function getSR(): (new () => SpeechRecognitionType) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}
export function isSpeechRecognitionAvailable(): boolean {
  return getSR() !== null
}

interface Props {
  /** Called repeatedly with the in-progress transcript (interim + final). */
  onTranscript: (text: string, isFinal: boolean) => void
  /** Called once with the final transcript when recording stops. */
  onFinal: (text: string) => void
  className?: string
}

export function VoiceButton({ onTranscript, onFinal, className }: Props) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const finalTextRef = useRef('')
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    navigator.vibrate?.(8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(recognitionRef.current as any)?.stop?.()
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
    safetyTimeoutRef.current = null
  }, [])

  const start = useCallback(() => {
    const SR = getSR()
    if (!SR) return
    finalTextRef.current = ''
    navigator.vibrate?.(10)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new (SR as any)() as any
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'

    r.onresult = (event: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTextRef.current += t
        } else {
          interim += t
        }
      }
      const display = (finalTextRef.current + interim).trim()
      if (display) onTranscript(display, false)
    }
    r.onerror = () => {
      setListening(false)
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
    }
    r.onend = () => {
      setListening(false)
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
      const final = finalTextRef.current.trim()
      if (final) {
        onTranscript(final, true)
        onFinal(final)
      }
    }

    r.start()
    recognitionRef.current = r
    setListening(true)

    // 60s hard safety timeout — release the mic.
    safetyTimeoutRef.current = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop?.()
    }, 60_000)
  }, [onFinal, onTranscript])

  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop?.()
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
    }
  }, [])

  if (!isSpeechRecognitionAvailable()) return null

  return (
    <button
      onClick={listening ? stop : start}
      className={cn(
        'flex items-center justify-center rounded-full transition-all min-w-[44px] min-h-[44px]',
        listening
          ? 'bg-red-500 text-white scale-110 shadow-lg animate-pulse'
          : 'bg-[var(--navy)] text-white hover:opacity-90',
        className,
      )}
      aria-label={listening ? 'Stop recording' : 'Start voice'}
    >
      {listening ? <Square size={18} /> : <Mic size={20} />}
    </button>
  )
}
