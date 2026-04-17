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

function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: number }
          if (parsed?.access_token && (parsed.expires_at ?? 0) > Math.floor(Date.now() / 1000)) {
            return true
          }
        } catch {
          // Legacy string-token format: presence counts.
          return true
        }
      }
    }
  } catch {
    // localStorage unavailable.
  }
  return false
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
    // Capture whether storage says we should be signed in. Used below to
    // decide whether a null auth event is "really signed out" vs "hydration
    // hasn't finished yet".
    const storedAtMount = hasStoredSession()

    // Safety net: if nothing resolves in 12s, allow /login to render rather
    // than spinning forever.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 12000)

    // Primary path: getSession() returns the session supabase-js hydrated
    // from localStorage. Profile is fetched with that session's user id.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data.session?.user) {
        setSession(data.session)
        const profile = await fetchProfile(data.session.user.id, data.session.user.email)
        if (!mounted) return
        if (profile) setUser(profile)
        clearTimeout(timeout)
        setLoading(false)
      } else if (!storedAtMount) {
        // No stored session and getSession agrees — /login should render.
        clearTimeout(timeout)
        setLoading(false)
      }
      // else: storage says we're signed in but supabase-js hasn't surfaced
      // it yet. Wait for onAuthStateChange; do NOT flip loading=false (that
      // would cause ProtectedRoute to redirect to /login).
    }).catch(() => {
      if (!mounted) return
      if (!storedAtMount) {
        clearTimeout(timeout)
        setLoading(false)
      }
    })

    // React to state changes. The key insight for the hard-reload bug:
    // during supabase-js hydration on page load, an INITIAL_SESSION event
    // can fire with a null session BEFORE the stored token is actually
    // parsed. The pre-#70 code treated that as "signed out" and cleared the
    // user, triggering ProtectedRoute → /login. Now we only clear on an
    // explicit SIGNED_OUT event.
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

      // Any other null-session event — swallow. Don't clear user, don't
      // flip loading. If the hydration never completes we'll still stop
      // loading via the 12s safety-net timeout.
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
