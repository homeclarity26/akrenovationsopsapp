// Demo chrome: top "demo" banner + bottom prompt bar with the explanation
// and an action button. Used by both employee and homeowner demos.

import type { ReactNode } from 'react'

export function DemoBanner({
  step,
  totalSteps,
  onExit,
}: {
  step: number
  totalSteps: number
  onExit?: () => void
}) {
  const pct = (step / totalSteps) * 100
  return (
    <div style={banner.wrap}>
      <div style={banner.row}>
        <div style={banner.label}>DEMO MODE</div>
        <div style={banner.counter}>
          {step} / {totalSteps}
        </div>
        {onExit && (
          <button onClick={onExit} style={banner.exit}>
            Exit
          </button>
        )}
      </div>
      <div style={banner.barOuter}>
        <div style={{ ...banner.barInner, width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function DemoPromptBar({
  title,
  body,
  actionLabel,
  onAction,
  hideAction,
}: {
  title: string
  body: string
  actionLabel: string | null
  onAction: () => void
  hideAction?: boolean
}) {
  return (
    <div style={prompt.wrap}>
      <div style={prompt.title}>{title}</div>
      <div style={prompt.body}>{body}</div>
      {!hideAction && actionLabel && (
        <button onClick={onAction} style={prompt.btn}>
          {actionLabel} →
        </button>
      )}
    </div>
  )
}

export function DemoStage({
  children,
}: {
  children: ReactNode
}) {
  return <div style={stage}>{children}</div>
}

const banner = {
  wrap: {
    background: '#1B2B4D',
    color: '#FFF',
    padding: '10px 16px 8px',
    flexShrink: 0,
  } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  } as const,
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.7)',
  } as const,
  counter: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 'auto',
    fontFamily: "'JetBrains Mono', monospace",
  } as const,
  exit: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#fff',
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
  } as const,
  barOuter: {
    height: 3,
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  } as const,
  barInner: {
    height: '100%',
    background: '#B7410E',
    transition: 'width 350ms ease',
  } as const,
}

const prompt = {
  wrap: {
    background: '#FFFFFF',
    borderTop: '1px solid #E8E8E6',
    padding: '16px 18px 22px',
    flexShrink: 0,
    boxShadow: '0 -8px 24px -12px rgba(27,43,77,0.10)',
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
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 1.55,
    marginBottom: 14,
  } as const,
  btn: {
    width: '100%',
    background: '#1B2B4D',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  } as const,
}

const stage = {
  padding: '16px 14px 24px',
} as const
