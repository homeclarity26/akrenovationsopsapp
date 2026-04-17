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

type Role = 'admin' | 'employee' | 'client' | 'super_admin'

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

// ── Storage helpers ─────────────────────────────────────────────────────────
// Read whatever Supabase persisted (key pattern: `sb-<project-ref>-auth-token`)
// and return the parsed session object or null if nothing usable is present.

interface StoredSession {
  access_token: string
  refresh_token?: string
  expires_at: number
  user?: { id?: string; email?: string }
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
          // Legacy string-token format — can't parse, skip.
        }
      }
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — no stored session.
  }
  return null
}

/** Decode a JWT payload without validating the signature. Safe: we only read
 *  claims the client already trusts Supabase to have issued. */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // base64url → base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    return JSON.parse(decodeURIComponent(escape(json))) as Record<string, unknown>
  } catch {
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

  // Profile row doesn't exist yet — should be created by the
  // on_auth_user_created trigger but race-condition safe fallback:
  return {
    id: userId,
    email: fallbackEmail ?? '',
    role: 'client',
    full_name: fallbackEmail?.split('@')[0] ?? 'User',
    avatar_url: null,
    company_id: null,
    platform_onboarding_complete: false,
    company_onboarding_complete: false,
    field_onboarding_complete: false,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // ── Step 1: try to restore the session directly from localStorage ──────
    // The Supabase JS client's own async hydration races badly with React on
    // a hard page-load: INITIAL_SESSION can fire with a null session before
    // the stored token is parsed, or getSession() can resolve null during
    // refresh, and the old handler in this file interpreted null as "logged
    // out" → ProtectedRoute → /login.
    //
    // Skip the race entirely: parse the stored JWT ourselves, set the user
    // optimistically, then in the background ask supabase-js to adopt the
    // same session via setSession() and fetch the real profile. If the
    // token is expired or malformed we fall through to the normal
    // getSession + onAuthStateChange path.
    const storedSession = readStoredSession()
    const now = Math.floor(Date.now() / 1000)

    if (storedSession && storedSession.access_token && storedSession.expires_at > now) {
      const jwt = decodeJwt(storedSession.access_token)
      const userId = typeof jwt?.sub === 'string' ? jwt.sub : null
      const emailFromJwt = typeof jwt?.email === 'string' ? jwt.email : ''

      if (userId) {
        // Stash the session immediately. We defer setUser until after
        // fetchProfile returns the real role — setting an optimistic
        // role='client' placeholder here made ProtectedRoute mis-route
        // super_admins to /client/progress on hard-reload. Instead we keep
        // loading=true while the profile fetch resolves, and flip user +
        // loading together once we know the real role.
        setSession(storedSession as unknown as Session)

        void fetchProfile(userId, emailFromJwt).then((profile) => {
          if (!mounted) return
          setUser(profile)
          clearTimeout(timeout)
          setLoading(false)
        })
        void supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token ?? '',
        }).catch(() => {
          // If setSession fails (bad token), onAuthStateChange will receive
          // SIGNED_OUT and clear state.
        })
      }
    }

    // Safety net: if the optimistic path above doesn't fire and nothing else
    // resolves in 12 seconds, unblock the UI so /login can render.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 12000)

    // ── Step 2: still run getSession() so supabase-js has a chance to catch
    //    up. If no stored token existed we rely on this path.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data.session?.user) {
        setSession(data.session)
        const profile = await fetchProfile(data.session.user.id, data.session.user.email)
        if (mounted && profile) setUser(profile)
        clearTimeout(timeout)
        setLoading(false)
      } else if (!storedSession) {
        // Truly no session anywhere — allow /login to render.
        clearTimeout(timeout)
        setLoading(false)
      }
      // else: stored token exists, optimistic user already set — nothing to do.
    })

    // ── Step 3: react to explicit state changes.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      if (newSession?.user) {
        setSession(newSession)
        const profile = await fetchProfile(newSession.user.id, newSession.user.email)
        if (mounted && profile) setUser(profile)
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      // Null session on any other event (INITIAL_SESSION, TOKEN_REFRESHED) —
      // do NOT clear the optimistic user. Wait for either a real session or
      // an explicit SIGNED_OUT.
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
