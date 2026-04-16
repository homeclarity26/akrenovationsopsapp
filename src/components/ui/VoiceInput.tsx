/**
 * VoiceInput — hold-to-talk voice input with waveform visualisation.
 *
 * Uses the Web SpeechRecognition API. Falls back gracefully:
 *   - If API unavailable, the component renders nothing (parent hides the mic).
 *   - Waveform uses an AnalyserNode from the MediaStream (getUserMedia).
 *   - Haptic feedback via navigator.vibrate(10) — no-op on unsupported devices.
 *
 * Transcript is surfaced as editable text; final result calls `onResult`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// SpeechRecognition type shim
// ---------------------------------------------------------------------------

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : unknown

function getSpeechRecognition(): (new () => SpeechRecognitionType) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechRecognition() !== null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VoiceInputProps {
  /** Called with the final transcript when the user releases the mic. */
  onResult: (transcript: string) => void
  /** Whether the mic is currently in use. Controlled externally for state sync. */
  active?: boolean
  className?: string
}

export function VoiceInput({ onResult, active: controlledActive, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = controlledActive ?? isListening

  // ---- Waveform drawing ----
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()

    const sliceWidth = canvas.width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * canvas.height) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }

    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()

    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  // ---- Start listening ----
  const start = useCallback(async () => {
    const SpeechRec = getSpeechRecognition()
    if (!SpeechRec) return

    // Haptic
    navigator.vibrate?.(10)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Waveform — reuse AudioContext across taps
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      } else if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      const source = audioCtxRef.current.createMediaStreamSource(stream)
      const analyser = audioCtxRef.current.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      drawWaveform()
    } catch {
      // Mic permission denied — still try speech recognition (uses its own mic)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRec as any)() as any
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const final = result[0].transcript
          setTranscript(final)
          onResult(final)
        } else {
          interim += result[0].transcript
        }
      }
      if (interim) setTranscript(interim)
    }

    recognition.onerror = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      setIsListening(false)
    }

    recognition.onend = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      setIsListening(false)
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
    setTranscript('')

    // 30s safety timeout
    timeoutRef.current = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop?.()
      timeoutRef.current = null
    }, 30_000)
  }, [onResult, drawWaveform])

  // ---- Stop listening ----
  const stop = useCallback(() => {
    navigator.vibrate?.(10)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(recognitionRef.current as any)?.stop?.()
    recognitionRef.current = null

    // Cleanup audio
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null

    setIsListening(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop?.()
      cancelAnimationFrame(animFrameRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  if (!isSpeechRecognitionAvailable()) return null

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {/* Hold-to-talk button */}
      <button
        onTouchStart={start}
        onTouchEnd={stop}
        onMouseDown={start}
        onMouseUp={stop}
        className={cn(
          'flex items-center justify-center rounded-full transition-all',
          'min-w-[44px] min-h-[44px]',
          active
            ? 'bg-red-500 text-white scale-110 shadow-lg'
            : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200',
        )}
        aria-label={active ? 'Release to stop recording' : 'Hold to talk'}
      >
        <Mic size={20} />
      </button>

      {/* Waveform canvas — only visible while recording */}
      {active && (
        <canvas
          ref={canvasRef}
          width={200}
          height={40}
          className="w-full max-w-[200px] h-10 rounded"
        />
      )}

      {/* Transcript preview */}
      {transcript && (
        <p className="text-xs text-[var(--text-secondary)] text-center max-w-[240px] truncate">
          {transcript}
        </p>
      )}
    </div>
  )
}
