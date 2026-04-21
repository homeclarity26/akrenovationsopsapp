// QuickActionLanding — the iOS Shortcut deep-link landing page.
//
// URL pattern: /employee/quick/<action>
//
// Supported actions (Phase 1):
//   shopping-add    → opens mic auto-listen, sends to add_shopping_item
//   clock-in        → fires clock_in immediately
//   clock-out       → fires clock_out immediately
//   note            → opens mic for an immediate add_daily_log dictation
//   photo           → opens camera for take_photo
//
// Adam can wire any of these into an iOS Shortcut on his lock screen:
//   1. Open Shortcuts.app → New Shortcut.
//   2. Add "Open URL" action with the URL above.
//   3. (Optional) Add a Siri voice trigger.
//   4. Add to Home Screen / Lock Screen widget.
// Worker taps once → app opens here → mic listens or action fires → done.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mic, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { sendMessage } from '@/lib/assistant/client'
import { VoiceButton, isSpeechRecognitionAvailable } from '@/components/assistant/VoiceButton'
import { supabase } from '@/lib/supabase'

type Action = 'shopping-add' | 'clock-in' | 'clock-out' | 'note' | 'photo'

const PROMPT_FOR: Record<Action, string> = {
  'shopping-add': 'Tell me what to add — e.g. "a box of 3-inch deck screws".',
  'clock-in': 'Clocking you in…',
  'clock-out': 'Clocking you out…',
  'note': 'Tell me what to log for today.',
  'photo': 'Camera will open for the photo.',
}

const FIRE_TEMPLATE: Record<Exclude<Action, 'shopping-add' | 'note' | 'photo'>, string> = {
  'clock-in': 'Clock me in.',
  'clock-out': 'Clock me out.',
}

export function QuickActionLanding() {
  const { action } = useParams<{ action: Action }>()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const [transcript, setTranscript] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const firedRef = useRef(false)

  const fire = useCallback(async (text: string) => {
    setStatus('busy')
    try {
      const resp = await sendMessage({ thread_id: null, message: text, context: { pathname: `/employee/quick/${action}` } })
      const lastTool = [...resp.messages].reverse().find((m) => m.role === 'tool')
      const lastAss = [...resp.messages].reverse().find((m) => m.role === 'assistant')
      setMessage(lastTool?.content ?? lastAss?.content ?? 'Done.')
      setStatus('done')
      setTimeout(() => navigate('/employee', { replace: true }), 1500)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.')
      setStatus('error')
    }
  }, [action, navigate])

  // Auto-fire instant actions (clock-in, clock-out) once auth + action ready.
  useEffect(() => {
    if (loading || !user) return
    if (firedRef.current) return
    if (action === 'clock-in' || action === 'clock-out') {
      firedRef.current = true
      void fire(FIRE_TEMPLATE[action])
    }
  }, [loading, user, action, fire])

  // Photo flow: trigger the file picker on mount.
  useEffect(() => {
    if (action !== 'photo' || loading || !user || firedRef.current) return
    firedRef.current = true
    setTimeout(() => fileInputRef.current?.click(), 200)
  }, [action, loading, user])

  const onPhotoSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setStatus('busy')
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.-]+/gi, '_')}`
    const { data: up, error } = await supabase.storage.from('project-photos').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      setMessage(error.message)
      setStatus('error')
      return
    }
    const { data: pub } = supabase.storage.from('project-photos').getPublicUrl(up.path)
    void fire(`Save this photo to my project: ${pub.publicUrl}`)
  }, [user?.id, fire])

  const onTranscript = useCallback((text: string) => setTranscript(text), [])
  const onFinal = useCallback((text: string) => {
    if (action === 'shopping-add') void fire(`Add to shopping list: ${text}`)
    else if (action === 'note') void fire(`Add a daily log: ${text}`)
    else void fire(text)
  }, [action, fire])

  if (loading) {
    return <Centered><Loader2 className="animate-spin" /> </Centered>
  }
  if (!user) {
    navigate('/login', { replace: true })
    return null
  }
  if (!action || !PROMPT_FOR[action as Action]) {
    return <Centered><p className="text-sm text-[var(--text-secondary)]">Unknown quick action.</p></Centered>
  }

  return (
    <div className="min-h-svh flex flex-col bg-[var(--bg)]">
      <div className="px-6 pt-12 pb-6 flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--navy)] flex items-center justify-center mb-4">
          <Mic size={28} className="text-white" />
        </div>
        <p className="text-base font-semibold text-[var(--text)] mb-1">Quick action</p>
        <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">{PROMPT_FOR[action as Action]}</p>

        {transcript && (
          <p className="text-sm text-[var(--navy)] font-semibold whitespace-pre-wrap break-words max-w-sm mb-4">{transcript}…</p>
        )}

        {(action === 'shopping-add' || action === 'note') && status === 'idle' && (
          <VoiceButton onTranscript={onTranscript} onFinal={onFinal} className="scale-150" />
        )}

        {!isSpeechRecognitionAvailable() && (action === 'shopping-add' || action === 'note') && (
          <button
            onClick={() => navigate('/employee', { replace: true })}
            className="px-4 py-2 rounded-full bg-[var(--cream-light)] text-[var(--text)] text-sm font-semibold"
          >
            Open chat
          </button>
        )}

        {status === 'busy' && (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 size={16} className="animate-spin" />
            Working…
          </div>
        )}

        {(status === 'done' || status === 'error') && (
          <div className={`mt-6 text-sm max-w-xs ${status === 'error' ? 'text-red-700' : 'text-[var(--success,#15803d)]'}`}>
            {message}
          </div>
        )}
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

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh flex items-center justify-center">{children}</div>
}
