// Real Supabase auth context. Replaces the earlier mock.
//
// Listens to supabase.auth state, fetches the user's profile row on login,
// and exposes signIn / signUp / signOut plus the current user and a loading
// flag. ProtectedRoute can wait on `loading` to avoid a redirect flicker
// before the auth state settles.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

type Role = 'admin' | 'employee' | 'client' | 'platform_owner'

export interface AppUser {
  id: string
  email: string
  role: Role
  full_name: string
  avatar_url: string | null
  company_id: string | null
  platform_onboarding_complete: boolean
  company_onboarding_complete: boolean
  field_onboarding_complete: boolean
  /** Phase 0 feature flag — true = chat-first AssistantHome, false = legacy tile UI. */
  ai_v2_enabled: boolean
  /** Optional voice-out for assistant replies (Web SpeechSynthesis). */
  ai_tts_enabled: boolean
}

interface AuthContextValue {
  user: AppUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Re-fetch the profile from Supabase and update in-memory user state. */
  refreshProfile: () => Promise<void>
  /** Legacy shim for any old code that calls `login(userId)` — no-op now. */
  login: (_userId: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface StoredAccessToken {
  access_token: string
  refresh_token?: string
  expires_at: number
  /** True when expires_at is in the past — caller must refresh before using. */
  expired: boolean
  /** The localStorage key, so we can rewrite it after a refresh. */
  storageKey: string
}

function readStoredAccessToken(): StoredAccessToken | null {
  try {
    const now = Math.floor(Date.now() / 1000)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string; expires_at?: number }
          if (parsed?.access_token) {
            const expiresAt = parsed.expires_at ?? 0
            return {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              expires_at: expiresAt,
              expired: expiresAt <= now,
              storageKey: key,
            }
          }
        } catch {
          // Legacy string-token format — can't parse.
        }
      }
    }
  } catch {
    // localStorage unavailable.
  }
  return null
}

/** Attempts to refresh an expired access token via the Supabase auth REST API.
 *  Does NOT go through supabase-js, because that client can wedge during
 *  hydration. Returns the refreshed token payload on success, null on failure
 *  (in which case the caller should clear localStorage and show /login). */
async function refreshAccessTokenRaw(refreshToken: string): Promise<StoredAccessToken | null> {
  const url = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''
  if (!url || !anon || !refreshToken) return null
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) {
      console.warn('[auth] refresh token HTTP', res.status)
      return null
    }
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number }
    if (!j?.access_token) return null
    const expiresAt = j.expires_at ?? (Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600))
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token ?? refreshToken,
      expires_at: expiresAt,
      expired: false,
      storageKey: '',
    }
  } catch (e) {
    console.warn('[auth] refreshAccessTokenRaw threw:', e)
    return null
  }
}

/** Writes a refreshed token back to localStorage under the same key format
 *  supabase-js uses, so onAuthStateChange events still see a valid session. */
function writeStoredAccessToken(storageKey: string, token: StoredAccessToken) {
  try {
    const existing = localStorage.getItem(storageKey)
    let parsed: Record<string, unknown> = {}
    if (existing) {
      try { parsed = JSON.parse(existing) as Record<string, unknown> } catch {}
    }
    parsed.access_token = token.access_token
    parsed.refresh_token = token.refresh_token
    parsed.expires_at = token.expires_at
    parsed.expires_in = Math.max(0, token.expires_at - Math.floor(Date.now() / 1000))
    parsed.token_type = 'bearer'
    localStorage.setItem(storageKey, JSON.stringify(parsed))
  } catch {
    // localStorage unavailable.
  }
}

/** Nuke every sb-*-auth-token key. Used when refresh fails — otherwise we'd
 *  keep retrying the same dead refresh_token on every page load. */
function clearStoredAuthTokens() {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? ''
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch {
    // localStorage unavailable.
  }
}

/** If the current URL has a supabase magic-link / OAuth fragment
 *  (`#access_token=…&refresh_token=…&expires_at=…`), parse it synchronously,
 *  write it to localStorage in the shape supabase-js uses, and clear the
 *  fragment from the URL. That way our cold-start hydrate path finds the
 *  token immediately rather than waiting on supabase-js's built-in
 *  detectSessionInUrl, which hangs during client init on WebKit.
 *
 *  The localStorage key format is `sb-<project-ref>-auth-token`, derived
 *  from VITE_SUPABASE_URL. */
function consumeUrlHashSessionIntoStorage() {
  try {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token=')) return
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expiresAtRaw = params.get('expires_at')
    const expiresInRaw = params.get('expires_in')
    if (!accessToken) return
    const expiresAt = expiresAtRaw
      ? parseInt(expiresAtRaw, 10)
      : Math.floor(Date.now() / 1000) + (expiresInRaw ? parseInt(expiresInRaw, 10) : 3600)

    // Derive the storage key supabase-js expects.
    const url = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
    const refMatch = url.match(/https?:\/\/([^.]+)\.supabase\.co/)
    const projectRef = refMatch?.[1] ?? ''
    if (!projectRef) return
    const storageKey = `sb-${projectRef}-auth-token`

    const stored = {
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
      expires_at: expiresAt,
      expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
      token_type: 'bearer',
    }
    localStorage.setItem(storageKey, JSON.stringify(stored))

    // Strip the fragment so back-button / refresh doesn't re-process it.
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    } catch {
      // Not critical — the fragment is harmless if it stays.
    }
  } catch {
    // Any failure is non-fatal — fall through to whatever storage already has.
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    return JSON.parse(decodeURIComponent(escape(json))) as Record<string, unknown>
  } catch {
    return null
  }
}

// Raw REST call that doesn't go through the supabase-js client — the
// client can hang in a broken hydration state. Reads the profile row using
// the stored access_token as a Bearer.
async function fetchProfileWithToken(userId: string, accessToken: string, fallbackEmail?: string): Promise<AppUser | null> {
  const url = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''
  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?select=id,role,full_name,email,avatar_url,company_id,platform_onboarding_complete,company_onboarding_complete,field_onboarding_complete,ai_v2_enabled,ai_tts_enabled&id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    )
    if (!res.ok) {
      console.warn('[auth] fetchProfileWithToken HTTP', res.status)
      return null
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const data = rows?.[0]
    if (!data) return null
    return {
      id: String(data.id),
      email: (data.email as string | null) ?? fallbackEmail ?? '',
      role: ((data.role as Role) ?? 'client'),
      full_name: (data.full_name as string | null) ?? fallbackEmail?.split('@')[0] ?? 'User',
      avatar_url: (data.avatar_url as string | null) ?? null,
      company_id: (data.company_id as string | null) ?? null,
      platform_onboarding_complete: Boolean(data.platform_onboarding_complete),
      company_onboarding_complete: Boolean(data.company_onboarding_complete),
      field_onboarding_complete: Boolean(data.field_onboarding_complete),
      ai_v2_enabled: Boolean(data.ai_v2_enabled),
      ai_tts_enabled: Boolean(data.ai_tts_enabled),
    }
  } catch (e) {
    console.warn('[auth] fetchProfileWithToken threw:', e)
    return null
  }
}

// NOTE: the supabase-js based fetchProfile() used to live here. It was
// removed because every caller now goes through fetchProfileWithToken
// (raw REST) — supabase-js's wedge during hydration was causing 12s
// spinner hangs when the stored token was expired or right after
// SIGNED_IN. See the repro in scripts/webkit-repro-stale-token.mjs.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // NEW STRATEGY — stop depending on supabase-js's async hydration.
    //
    // Read the stored session from localStorage SYNCHRONOUSLY. If it has a
    // non-expired access_token, decode the JWT to get the user id, fetch
    // the profile with a raw fetch that passes the stored token as bearer
    // (sidesteps supabase-js's internal _useSession wedge), then set user.
    //
    // Only AFTER we have a working user do we hand off to supabase-js's
    // auth state machine via getSession() in the background, so sign-in /
    // sign-out events still flow through onAuthStateChange as before.
    //
    // Five previous AuthContext iterations (#70 #72 #73 #74 #75 #76) tried
    // to reconcile with supabase-js's hydration and each hit a different
    // edge. This version simply doesn't wait on it.

    // If this is a magic-link landing (URL has #access_token=…), extract
    // the session ourselves and write it to localStorage in the exact shape
    // supabase-js uses. This avoids waiting on supabase-js's URL-hash
    // detection (which hangs during cold-start on WebKit — same wedge that
    // getSession() hits). After this runs, readStoredAccessToken() below
    // will find the token as if it had always been there.
    consumeUrlHashSessionIntoStorage()

    const storedAtMount = readStoredAccessToken()

    // Safety net — unblock /login if literally nothing resolves within 6s.
    // Dropped from 12s to 6s now that both the cold-start and the expired-
    // token paths below avoid supabase-js's hanging getSession().
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 6000)

    const hydrate = async () => {
      // ── No stored token → skip supabase-js.auth.getSession() entirely.
      //    That call wedges on WebKit during cold-start (see the history at
      //    the top of this file). If localStorage is empty, the user needs
      //    to log in; unblock immediately and route to /login.
      if (!storedAtMount) {
        if (mounted) {
          clearTimeout(timeout)
          setLoading(false)
        }
        return
      }

      // ── Expired token → attempt a raw-REST refresh. If it succeeds,
      //    rewrite localStorage so the next cold-start is fast, and fall
      //    through to the fresh-token path. If refresh fails, nuke the
      //    stored keys and land on /login (beats spinning for 12s).
      let token = storedAtMount
      if (token.expired) {
        if (!token.refresh_token) {
          clearStoredAuthTokens()
          if (mounted) { clearTimeout(timeout); setLoading(false) }
          return
        }
        const refreshed = await refreshAccessTokenRaw(token.refresh_token)
        if (!refreshed) {
          clearStoredAuthTokens()
          if (mounted) { clearTimeout(timeout); setLoading(false) }
          return
        }
        writeStoredAccessToken(storedAtMount.storageKey, refreshed)
        token = { ...refreshed, storageKey: storedAtMount.storageKey }
      }

      // ── Fresh token → bypass supabase-js and hydrate the user ourselves
      //    so the UI unblocks immediately.
      const jwt = decodeJwtPayload(token.access_token)
      const userId = typeof jwt?.sub === 'string' ? jwt.sub : null
      const emailFromJwt = typeof jwt?.email === 'string' ? jwt.email : undefined

      if (!userId) {
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      // Raw REST call with the stored token — does not block on supabase-js
      // being "ready".
      const profile = await fetchProfileWithToken(userId, token.access_token, emailFromJwt)
      if (!mounted) return
      if (profile) setUser(profile)
      // Stash session so `useAuth().session?.access_token` reads correctly.
      setSession({ access_token: token.access_token, refresh_token: token.refresh_token ?? '' } as unknown as Session)
      clearTimeout(timeout)
      setLoading(false)
    }

    hydrate()

    // Subscribe to auth state changes so explicit sign-in / sign-out events
    // still work. Only a genuine SIGNED_OUT clears the user — other
    // null-session events during hydration are ignored (see history above).
    //
    // Post-login profile fetch goes through the raw-REST helper (same path
    // used during hydration). The supabase-js client can still be in a
    // half-hydrated state the moment SIGNED_IN fires; hitting PostgREST
    // directly with the new session's access_token sidesteps that.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (newSession?.user) {
        setSession(newSession)
        const profile = await fetchProfileWithToken(
          newSession.user.id,
          newSession.access_token,
          newSession.user.email,
        )
        if (!mounted) return
        if (profile) setUser(profile)
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        clearTimeout(timeout)
        setLoading(false)
        return
      }
      // swallow all other null-session events
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription?.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
      },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const refreshProfile = async () => {
    if (!session?.access_token) return
    // Raw REST — avoids supabase-js hang, same rationale as hydrate + SIGNED_IN.
    const jwt = decodeJwtPayload(session.access_token)
    const userId = typeof jwt?.sub === 'string' ? jwt.sub : null
    if (!userId) return
    const profile = await fetchProfileWithToken(userId, session.access_token)
    if (profile) setUser(profile)
  }

  // Legacy no-op — old code path that used `login(userId)` from mock
  const login = (_userId: string) => {
    console.warn('[auth] legacy login() called — use signIn(email, password) instead')
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, refreshProfile, login }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
