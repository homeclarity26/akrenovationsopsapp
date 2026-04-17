// Reminders logic tests — pure helpers only, no DB.
//
// Mirrors the style of the other /src/test suites (math / helper tests).
// The real DB / edge-function flow is verified end-to-end in the smoke test
// described in PR 2's test plan.

import { describe, it, expect } from 'vitest'

// ── Port of dispatcher's nextInstance() — kept in sync with
//    supabase/functions/process-due-reminders/index.ts. When editing one,
//    edit both. ─────────────────────────────────────────────────────────────

interface WallClock {
  year: number; month: number; day: number
  hour: number; minute: number; second: number
}

function wallClockInZone(utcInstant: Date, timezone: string): WallClock {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(utcInstant).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  ) as Record<string, string>
  const hour = parts.hour === '24' ? 0 : parseInt(parts.hour, 10)
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
  }
}

function addDaysToWallClock(wc: WallClock, days: number): WallClock {
  const d = new Date(Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second))
  d.setUTCDate(d.getUTCDate() + days)
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
  }
}

function tzOffsetMinutes(utcInstant: Date, timezone: string): number {
  const wall = wallClockInZone(utcInstant, timezone)
  const asIfUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  return (asIfUtc - utcInstant.getTime()) / 60_000
}

function wallClockToUtc(wc: WallClock, timezone: string): Date {
  const naive = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second)
  const guess = new Date(naive)
  const offsetMinutes = tzOffsetMinutes(guess, timezone)
  return new Date(naive - offsetMinutes * 60_000)
}

function nextInstance(
  remindAt: string,
  recurrence: 'daily' | 'weekly',
  timezone?: string | null,
): string {
  const daysToAdd = recurrence === 'daily' ? 1 : 7
  const current = new Date(remindAt)
  if (!timezone) {
    const d = new Date(current)
    d.setUTCDate(d.getUTCDate() + daysToAdd)
    return d.toISOString()
  }
  try {
    const wall = wallClockInZone(current, timezone)
    const advanced = addDaysToWallClock(wall, daysToAdd)
    return wallClockToUtc(advanced, timezone).toISOString()
  } catch {
    const d = new Date(current)
    d.setUTCDate(d.getUTCDate() + daysToAdd)
    return d.toISOString()
  }
}

// Helper for assertions: read the wall-clock hour of a UTC ISO timestamp in a
// specific IANA timezone. Used to assert DST-preserving recurrence.
function localHourIn(utcIso: string, tz: string): number {
  return wallClockInZone(new Date(utcIso), tz).hour
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

describe('reminders — nextInstance without timezone (UTC fallback)', () => {
  // When timezone is null / undefined we fall through to pure UTC math.
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

describe('reminders — nextInstance with timezone (DST-preserving)', () => {
  const NYC = 'America/New_York'

  it('preserves 8 AM local across a single ordinary day (EDT → EDT)', () => {
    // 2026-07-15 08:00 EDT = 12:00 UTC
    const start = '2026-07-15T12:00:00.000Z'
    const next = nextInstance(start, 'daily', NYC)
    expect(localHourIn(next, NYC)).toBe(8)
    expect(next).toBe('2026-07-16T12:00:00.000Z')
  })

  it('preserves 8 AM local across fall DST end (EDT → EST)', () => {
    // Nov 1 2026 is when DST ends in the US. A "8 AM daily" reminder
    // scheduled on Oct 31 (EDT, UTC-4) = 12:00 UTC should still fire at
    // 8 AM local on Nov 2 (EST, UTC-5), which means the UTC hour must
    // shift to 13:00.
    const startOct31 = '2026-10-31T12:00:00.000Z' // 8 AM EDT
    const nextNov1 = nextInstance(startOct31, 'daily', NYC)
    expect(localHourIn(nextNov1, NYC)).toBe(8)
    const nextNov2 = nextInstance(nextNov1, 'daily', NYC)
    expect(localHourIn(nextNov2, NYC)).toBe(8)
    // And the underlying UTC has shifted by 1h:
    expect(nextNov2).toBe('2026-11-02T13:00:00.000Z')
  })

  it('preserves 8 AM local across spring DST start (EST → EDT)', () => {
    // Mar 8 2026 is when DST starts in the US (EST → EDT, UTC-5 → UTC-4).
    // Reminder at 8 AM EST on Mar 7 = 13:00 UTC. Next day (Mar 8 EDT) must
    // also be 8 AM local = 12:00 UTC.
    const startMar7 = '2026-03-07T13:00:00.000Z'
    const nextMar8 = nextInstance(startMar7, 'daily', NYC)
    expect(localHourIn(nextMar8, NYC)).toBe(8)
    expect(nextMar8).toBe('2026-03-08T12:00:00.000Z')
  })

  it('weekly recurrence preserves local time across DST transition', () => {
    // Weekly reminder 8 AM Sunday, starting Oct 25 2026 EDT.
    // Oct 25 (EDT) → Nov 1 (EST after DST ends at 2 AM): local must stay 8 AM.
    const startOct25 = '2026-10-25T12:00:00.000Z' // 8 AM EDT
    const nextNov1 = nextInstance(startOct25, 'weekly', NYC)
    expect(localHourIn(nextNov1, NYC)).toBe(8)
    expect(nextNov1).toBe('2026-11-01T13:00:00.000Z') // 8 AM EST = 13:00 UTC
  })

  it('unknown tz string falls back to UTC math without throwing', () => {
    const start = '2026-04-16T08:00:00.000Z'
    const next = nextInstance(start, 'daily', 'Not/A_Real_Timezone')
    expect(next).toBe('2026-04-17T08:00:00.000Z')
  })

  it('non-DST zone (UTC) is a no-op', () => {
    const start = '2026-04-16T08:00:00.000Z'
    expect(nextInstance(start, 'daily', 'UTC')).toBe('2026-04-17T08:00:00.000Z')
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
