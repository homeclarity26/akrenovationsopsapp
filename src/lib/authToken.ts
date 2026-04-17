// Read the user's access token + id without waiting on
// `supabase.auth.getSession()`, which can hang indefinitely during a broken
// hydration window (observed in production after aggressive token rotation).
//
// Strategy: first try localStorage directly (synchronous, never hangs). If
// the stored token parses and hasn't expired, use it. Fall back to
// getSession() as a timed race only if no stored token is found.

import { supabase } from './supabase'

interface StoredSession {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  user?: { id?: string; email?: string }
}

export interface AuthToken {
  accessToken: string | null
  userId: string | null
  email: string | null
}

function readStoredSession(): StoredSession | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw) as StoredSession
          if (parsed?.access_token) return parsed
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // localStorage unavailable
  }
  return null
}

export async function resolveAuthToken(timeoutMs = 800): Promise<AuthToken> {
  const stored = readStoredSession()
  const now = Math.floor(Date.now() / 1000)

  if (stored?.access_token && (stored.expires_at ?? 0) > now) {
    return {
      accessToken: stored.access_token,
      userId: stored.user?.id ?? null,
      email: stored.user?.email ?? null,
    }
  }

  // No usable stored token — race getSession against a short timeout so
  // callers don't hang the UI if supabase-js is wedged.
  const sessionPromise = supabase.auth.getSession().then(({ data }) => data.session)
  const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))
  const session = await Promise.race([sessionPromise, timeoutPromise]).catch(() => null)

  if (session?.access_token) {
    return {
      accessToken: session.access_token,
      userId: session.user?.id ?? null,
      email: session.user?.email ?? null,
    }
  }

  return { accessToken: null, userId: null, email: null }
}
