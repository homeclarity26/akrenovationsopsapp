// Tiny Web SpeechSynthesis wrapper.
//
// Used by AssistantHome to speak assistant replies aloud when the user has
// `ai_tts_enabled = true`. Per-message stop button cancels the queue.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

export function isTTSAvailable(): boolean {
  return !!synth
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export function speak(text: string, opts?: { rate?: number; pitch?: number; voice?: SpeechSynthesisVoice }): void {
  if (!synth) return
  // Don't queue another while one is going; clipping is better than overlap.
  cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = opts?.rate ?? 1.0
  u.pitch = opts?.pitch ?? 1.0
  if (opts?.voice) u.voice = opts.voice
  currentUtterance = u
  u.onend = () => {
    if (currentUtterance === u) currentUtterance = null
  }
  synth.speak(u)
}

export function cancel(): void {
  if (!synth) return
  synth.cancel()
  currentUtterance = null
}

export function isSpeaking(): boolean {
  return synth?.speaking ?? false
}

/** Best Safari iOS voice if available — otherwise default. */
export function pickPreferredVoice(): SpeechSynthesisVoice | undefined {
  if (!synth) return undefined
  const voices = synth.getVoices()
  // Prefer en-US system default.
  return (
    voices.find((v) => v.lang === 'en-US' && v.default) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices[0]
  )
}
