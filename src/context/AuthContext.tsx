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
}

function readStoredAccessToken(): StoredAccessToken | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string; expires_at?: number }
          if (parsed?.access_token && (parsed.expires_at ?? 0) > Math.floor(Date.now() / 1000)) {
            return { access_token: parsed.access_token, refresh_token: parsed.refresh_token, expires_at: parsed.expires_at ?? 0 }
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
      `${url}/rest/v1/profiles?select=id,role,full_name,email,avatar_url,company_id,platform_onboarding_complete,company_onboarding_complete,field_onboarding_complete&id=eq.${encodeURIComponent(userId)}&limit=1`,
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
    }
  } catch (e) {
    console.warn('[auth] fetchProfileWithToken threw:', e)
    return null
  }
}

async function fetchProfile(userId: string, fallbackEmail?: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, avatar_url, company_id, platform_onboarding_complete, company_onboarding_complete, field_onboarding_complete')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[auth] fetchProfile error:', error.message)
    return null
  }

  if (data) {
    return {
      id: data.id,
      email: data.email ?? fallbackEmail ?? '',
      role: (data.role as Role) ?? 'client',
      full_name: data.full_name ?? (fallbackEmail?.split('@')[0] ?? 'User'),
      avatar_url: data.avatar_url,
      company_id: data.company_id ?? null,
      platform_onboarding_complete: data.platform_onboarding_complete ?? false,
      company_onboarding_complete: data.company_onboarding_complete ?? false,
      field_onboarding_complete: data.field_onboarding_complete ?? false,
    }
  }

  return null
}

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

    const storedAtMount = readStoredAccessToken()

    // Safety net — unblock /login if literally nothing resolves.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 12000)

    const hydrate = async () => {
      // ── No stored token → let supabase-js handle the cold-start flow.
      if (!storedAtMount) {
        try {
          const { data } = await supabase.auth.getSession()
          if (!mounted) return
          if (data.session?.user) {
            setSession(data.session)
            const profile = await fetchProfile(data.session.user.id, data.session.user.email)
            if (mounted && profile) setUser(profile)
          }
        } catch {
          // ignore
        } finally {
          if (mounted) {
            clearTimeout(timeout)
            setLoading(false)
          }
        }
        return
      }

      // ── Stored token exists → bypass supabase-js and hydrate the user
      //    ourselves so the UI unblocks immediately.
      const jwt = decodeJwtPayload(storedAtMount.access_token)
      const userId = typeof jwt?.sub === 'string' ? jwt.sub : null
      const emailFromJwt = typeof jwt?.email === 'string' ? jwt.email : undefined

      if (!userId) {
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      // Raw REST call with the stored token — does not block on supabase-js
      // being "ready".
      const profile = await fetchProfileWithToken(userId, storedAtMount.access_token, emailFromJwt)
      if (!mounted) return
      if (profile) setUser(profile)
      // Stash session so `useAuth().session?.access_token` reads correctly.
      setSession({ access_token: storedAtMount.access_token, refresh_token: storedAtMount.refresh_token ?? '' } as unknown as Session)
      clearTimeout(timeout)
      setLoading(false)
    }

    hydrate()

    // Subscribe to auth state changes so explicit sign-in / sign-out events
    // still work. Only a genuine SIGNED_OUT clears the user — other
    // null-session events during hydration are ignored (see history above).
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (newSession?.user) {
        setSession(newSession)
        const profile = await fetchProfile(newSession.user.id, newSession.user.email)
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
    if (!session?.user) return
    const profile = await fetchProfile(session.user.id, session.user.email)
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
