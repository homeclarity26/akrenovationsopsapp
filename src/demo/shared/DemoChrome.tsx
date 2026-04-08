// Demo chrome: top banner (progress + exit) and bottom prompt bar
// (title + explanation + always-visible next button). Used by both demos.
//
// Design principles:
//   1. The Next button is ALWAYS visible (flex-shrink: 0 in the phone frame).
//   2. The Next button always says "Next →" (or "Start" / "Finish") so the
//      user knows exactly where to go. No "Tap X" confusion.
//   3. The explanation stays short. If it's too long to fit the footer area
//      without overflowing, the middle content scrolls — the footer doesn't.
//   4. Keyboard support: Space / Enter / → all trigger advance. Esc exits.

import type { ReactNode } from 'react'
import { useEffect } from 'react'

// ───────────────────────── Banner (top) ─────────────────────────

export function DemoBanner({
  step,
  totalSteps,
  onExit,
}: {
  step: number
  totalSteps: number
  onExit?: () => void
}) {
  const pct = Math.round((step / totalSteps) * 100)
  return (
    <div style={banner.wrap}>
      <div style={banner.row}>
        <div style={banner.brand}>AK</div>
        <div style={banner.label}>DEMO · {step} of {totalSteps}</div>
        {onExit && (
          <button
            onClick={onExit}
            style={banner.exit}
            aria-label="Restart demo from the beginning"
          >
            Restart
          </button>
        )}
      </div>
      <div style={banner.barOuter} aria-hidden>
        <div style={{ ...banner.barInner, width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ───────────────────────── Prompt bar (bottom) ─────────────────────────

export function DemoPromptBar({
  title,
  body,
  onAction,
  buttonLabel = 'Next',
  disabled = false,
  pulse = false,
}: {
  title: string
  body: string
  onAction: () => void
  buttonLabel?: string
  disabled?: boolean
  pulse?: boolean
}) {
  // Keyboard shortcuts: Space / Enter / ArrowRight advance.
  useEffect(() => {
    if (disabled) return
    const handler = (e: KeyboardEvent) => {
      // Ignore when the user is typing into an input/textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        onAction()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onAction, disabled])

  return (
    <div style={prompt.wrap}>
      <div style={prompt.title}>{title}</div>
      <div style={prompt.body}>{body}</div>
      <button
        onClick={onAction}
        disabled={disabled}
        style={{
          ...prompt.btn,
          opacity: disabled ? 0.35 : 1,
          cursor: disabled ? 'default' : 'pointer',
          animation: pulse && !disabled ? 'demo-btn-pulse 2s ease-in-out infinite' : 'none',
        }}
      >
        {buttonLabel} →
      </button>
      <style>{`
        @keyframes demo-btn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(183, 65, 14, 0.45); }
          50% { box-shadow: 0 0 0 8px rgba(183, 65, 14, 0); }
        }
      `}</style>
    </div>
  )
}

// ───────────────────────── Stage wrapper ─────────────────────────

export function DemoStage({ children }: { children: ReactNode }) {
  return <div style={stage}>{children}</div>
}

// ───────────────────────── Styles ─────────────────────────

const banner = {
  wrap: {
    background: '#1B2B4D',
    color: '#FFF',
    padding: '12px 18px 10px',
    flexShrink: 0,
  } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  } as const,
  brand: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.04em',
    color: '#FFFFFF',
    background: '#B7410E',
    width: 24,
    height: 24,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: "'JetBrains Mono', monospace",
  } as const,
  exit: {
    marginLeft: 'auto',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.22)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10.5,
    padding: '4px 11px',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    letterSpacing: '0.03em',
  } as const,
  barOuter: {
    height: 3,
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 4,
    overflow: 'hidden',
  } as const,
  barInner: {
    height: '100%',
    background: '#B7410E',
    transition: 'width 420ms cubic-bezier(0.22, 0.61, 0.36, 1)',
  } as const,
}

const prompt = {
  wrap: {
    background: '#FFFFFF',
    borderTop: '1px solid #E8E8E6',
    padding: '16px 18px 20px',
    flexShrink: 0,
    boxShadow: '0 -12px 30px -18px rgba(27,43,77,0.18)',
    // Safe area inset for notched phones
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
  } as const,
  title: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 19,
    fontWeight: 500,
    color: '#1B2B4D',
    marginBottom: 6,
    lineHeight: 1.25,
  } as const,
  body: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 1.55,
    marginBottom: 14,
  } as const,
  btn: {
    width: '100%',
    background: '#B7410E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    padding: '15px',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.01em',
    transition: 'transform 120ms ease, background 120ms ease',
  } as const,
}

const stage = {
  padding: '16px 14px 28px',
} as const
