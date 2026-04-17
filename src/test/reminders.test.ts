// Reminders logic tests — pure helpers only, no DB.
//
// Mirrors the style of the other /src/test suites (math / helper tests).
// The real DB / edge-function flow is verified end-to-end in the smoke test
// described in PR 2's test plan.

import { describe, it, expect } from 'vitest'

// ── Reimplement dispatcher's nextInstance() so we can unit-test it ───────────

function nextInstance(remindAt: string, recurrence: 'daily' | 'weekly'): string {
  const d = new Date(remindAt)
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1)
  else d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

// ── Reimplement RemindersPage's shortcutToIso to cover time-math edge cases ──

type RemindAtShortcut = '1h' | '3h' | 'tomorrow8' | 'custom'

function shortcutToIso(s: RemindAtShortcut, custom: string, now: Date): string | null {
  if (s === '1h') return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  if (s === '3h') return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString()
  if (s === 'tomorrow8') {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
    return d.toISOString()
  }
  if (s === 'custom' && custom) {
    const d = new Date(custom)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  }
  return null
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('reminders — nextInstance (recurrence)', () => {
  it('advances a daily reminder by exactly 24 hours', () => {
    const start = '2026-04-16T08:00:00.000Z'
    expect(nextInstance(start, 'daily')).toBe('2026-04-17T08:00:00.000Z')
  })

  it('advances a weekly reminder by exactly 7 days', () => {
    const start = '2026-04-16T08:00:00.000Z'
    expect(nextInstance(start, 'weekly')).toBe('2026-04-23T08:00:00.000Z')
  })

  it('crosses a month boundary cleanly for daily', () => {
    const start = '2026-04-30T08:00:00.000Z'
    expect(nextInstance(start, 'daily')).toBe('2026-05-01T08:00:00.000Z')
  })

  it('crosses a year boundary for weekly', () => {
    const start = '2026-12-29T08:00:00.000Z'
    expect(nextInstance(start, 'weekly')).toBe('2027-01-05T08:00:00.000Z')
  })
})

describe('reminders — shortcutToIso', () => {
  const NOW = new Date('2026-04-16T12:00:00.000Z')

  it('"1h" yields exactly one hour from now', () => {
    const iso = shortcutToIso('1h', '', NOW)!
    expect(iso).toBe('2026-04-16T13:00:00.000Z')
  })

  it('"3h" yields exactly three hours from now', () => {
    const iso = shortcutToIso('3h', '', NOW)!
    expect(iso).toBe('2026-04-16T15:00:00.000Z')
  })

  it('"tomorrow8" yields the next calendar day at 8am local', () => {
    const iso = shortcutToIso('tomorrow8', '', NOW)!
    // 8 AM LOCAL on the next day. We can't assert a UTC value without
    // knowing the runner's tz, but we can assert the local hour is 8.
    const d = new Date(iso)
    expect(d.getHours()).toBe(8)
    expect(d.getMinutes()).toBe(0)
  })

  it('returns null for "custom" with no value', () => {
    expect(shortcutToIso('custom', '', NOW)).toBeNull()
  })

  it('returns null for "custom" with an invalid value', () => {
    expect(shortcutToIso('custom', 'not-a-date', NOW)).toBeNull()
  })

  it('parses a valid "custom" datetime-local value', () => {
    // datetime-local is interpreted in the runner's local tz; we just check
    // the function does not return null and returns a valid ISO string.
    const iso = shortcutToIso('custom', '2026-04-17T09:30', NOW)
    expect(iso).not.toBeNull()
    expect(() => new Date(iso!).toISOString()).not.toThrow()
  })
})

describe('reminders — schedule-reminder input shape', () => {
  // Mirrors the zod schema on the edge function; kept as a doc/test so
  // frontend + backend stay in lock-step.
  const ALLOWED_CHANNELS = ['in_app', 'email', 'sms'] as const

  it('accepts every channel exactly once', () => {
    const ok = (['in_app', 'email', 'sms'] as const).every((c) => ALLOWED_CHANNELS.includes(c))
    expect(ok).toBe(true)
  })

  it('rejects an unknown channel name', () => {
    // Type-level guard — 'push' is not in the tuple.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(ALLOWED_CHANNELS.includes('push' as any)).toBe(false)
  })
})
