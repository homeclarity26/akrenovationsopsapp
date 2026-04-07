// Shared AI scene — used by BOTH the employee demo and the homeowner demo.
// Built ONCE. Calls the demo-ai edge function which proxies to Claude Haiku.
// Falls back to a hardcoded response if the network call fails so the demo
// always feels real, even offline.
//
// Zero Supabase imports. Zero auth. Public.

import { useState } from 'react'

export interface AISceneProps {
  systemPrompt: string
  suggestedPrompt: string
  sceneDescription: string
  fallbackResponse: string
  speakerLabel?: string // e.g. "AK Ops AI"
  onComplete: () => void
  continueLabel?: string
}

const AI_ENDPOINT =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_DEMO_AI_URL?: string } }).env
      ?.VITE_DEMO_AI_URL) ||
  '/api/demo-ai'

export function AIScene({
  systemPrompt,
  suggestedPrompt,
  sceneDescription,
  fallbackResponse,
  speakerLabel = 'AK Ops AI',
  onComplete,
  continueLabel = 'Continue walkthrough',
}: AISceneProps) {
  const [input, setInput] = useState(suggestedPrompt)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasResponded, setHasResponded] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)

  async function askAI() {
    if (!input.trim()) return
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          message: input,
          model: 'claude-haiku-4-5',
          max_tokens: 300,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) throw new Error(`status ${res.status}`)
      const data = (await res.json()) as { text?: string }
      const text = (data.text || '').trim()
      if (!text) throw new Error('empty response')
      setResponse(text)
    } catch {
      // Graceful fallback — demo never breaks
      setResponse(fallbackResponse)
      setUsedFallback(true)
    } finally {
      setHasResponded(true)
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.userBubble}>
        <div style={styles.userLabel}>You</div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || hasResponded}
          style={styles.textarea}
          placeholder="Type your question or use the suggestion above..."
        />
      </div>

      {!hasResponded && (
        <button
          onClick={askAI}
          disabled={loading || !input.trim()}
          style={{
            ...styles.askBtn,
            opacity: loading || !input.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'AI is thinking…' : 'Ask the AI'}
        </button>
      )}

      {loading && (
        <div style={styles.thinking}>
          <span style={styles.dot} />
          <span style={{ ...styles.dot, animationDelay: '120ms' }} />
          <span style={{ ...styles.dot, animationDelay: '240ms' }} />
        </div>
      )}

      {hasResponded && response && (
        <>
          <div style={styles.aiBubble}>
            <div style={styles.aiLabel}>{speakerLabel}</div>
            <div style={styles.aiText}>{response}</div>
            {usedFallback && (
              <div style={styles.fallbackNote}>
                Demo response — your real workflow uses the live AI.
              </div>
            )}
          </div>

          <div style={styles.sceneNote}>{sceneDescription}</div>

          <button onClick={onComplete} style={styles.continueBtn}>
            {continueLabel} →
          </button>
        </>
      )}

      <style>{`
        @keyframes ai-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  wrap: {
    padding: '20px',
    width: '100%',
  } as const,
  userBubble: {
    background: '#F5F5F3',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 12,
  } as const,
  userLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
  } as const,
  textarea: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    fontSize: 15,
    lineHeight: 1.5,
    resize: 'none',
    outline: 'none',
    minHeight: 64,
    color: '#1A1A1A',
    fontFamily: 'inherit',
  } as const,
  askBtn: {
    width: '100%',
    background: '#1B2B4D',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 12,
    cursor: 'pointer',
  } as const,
  thinking: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    padding: '14px 0 18px',
  } as const,
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#1B2B4D',
    display: 'inline-block',
    animation: 'ai-pulse 1.2s ease-in-out infinite',
  } as const,
  aiBubble: {
    background: '#1B2B4D',
    borderRadius: 14,
    padding: '16px 18px',
    marginBottom: 14,
  } as const,
  aiLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
  } as const,
  aiText: {
    fontSize: 15,
    color: 'white',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  } as const,
  fallbackNote: {
    marginTop: 12,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  } as const,
  sceneNote: {
    background: '#FFF5F0',
    border: '1px solid #F3D9C9',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 13,
    color: '#7A2A0A',
    marginBottom: 16,
    lineHeight: 1.5,
  } as const,
  continueBtn: {
    width: '100%',
    background: '#B7410E',
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  } as const,
}
