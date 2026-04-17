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

    // Does localStorage look like it already contains a signed-in session?
    // Supabase JS persists sessions under keys like `sb-<ref>-auth-token`. If
    // any one of those is present we should NOT clear `user` to null on an
    // INITIAL_SESSION event with a null session — that event races with the
    // client's async hydration on page load and can fire before the stored
    // token is parsed. Clearing user in that case causes ProtectedRoute to
    // bounce us to /login on every hard-refresh of an authenticated page.
    const hasStoredSession = (() => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) ?? ''
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const raw = localStorage.getItem(key)
            if (!raw) continue
            try {
              const parsed = JSON.parse(raw) as { access_token?: string }
              if (parsed?.access_token) return true
            } catch {
              // Legacy string-token format — treat presence as "yes".
              return true
            }
          }
        }
        return false
      } catch {
        return false
      }
    })()

    // Safety-net timeout: if nothing resolves in 20s, stop showing the
    // loading spinner so the user isn't stuck indefinitely. 20s is
    // deliberately generous — on a cold/slow network the initial session
    // restore + refresh + profile fetch can run long, and the previous 8s
    // fallback was firing during normal loads and forcing a logout.
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 20000)

    // Initial session check. No explicit timeout race — on a page with a
    // stored session the Supabase client restores synchronously from
    // localStorage and this resolves immediately. If the client is wedged
    // the safety-net timeout above still unblocks the UI.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data.session?.user) {
        setSession(data.session)
        const profile = await fetchProfile(data.session.user.id, data.session.user.email)
        if (mounted) setUser(profile)
        clearTimeout(timeout)
        setLoading(false)
      } else if (!hasStoredSession) {
        // No session anywhere — stop loading so /login can render.
        clearTimeout(timeout)
        setLoading(false)
      }
      // else: stored token exists but getSession hasn't returned it yet.
      // Wait for onAuthStateChange to fire — don't prematurely flip loading.
    }).catch(() => {
      // getSession should not reject, but be defensive.
      if (!mounted) return
      if (!hasStoredSession) {
        clearTimeout(timeout)
        setLoading(false)
      }
    })

    // Subscribe to auth changes (sign in, sign out, token refresh, initial).
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (newSession?.user) {
        setSession(newSession)
        const profile = await fetchProfile(newSession.user.id, newSession.user.email)
        if (mounted) setUser(profile)
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      // newSession is null. Decide whether this actually means "signed out".
      //
      // - SIGNED_OUT is unambiguous: user deliberately logged out, or the
      //   refresh token expired.
      // - USER_DELETED: treat as signed out.
      // - INITIAL_SESSION with null session: can fire during the async
      //   hydration window even when a valid token is in localStorage.
      //   If storage says we're signed in, wait for the real session to
      //   arrive (a subsequent TOKEN_REFRESHED / SIGNED_IN event) instead
      //   of flipping the user to null and triggering a redirect.
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      if (event === 'INITIAL_SESSION' && hasStoredSession) {
        // Session in storage but client didn't surface it yet — keep waiting.
        return
      }

      // Any other case with a null session and no stored token: log out.
      setSession(null)
      setUser(null)
      clearTimeout(timeout)
      setLoading(false)
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
