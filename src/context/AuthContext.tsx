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

    // Safety net: if auth hasn't resolved in 8 seconds, unblock the UI
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    // Initial session check — race against timeout so a stuck token-refresh
    // never blocks the UI indefinitely.
    const sessionPromise = supabase.auth.getSession()
    const sessionTimeout = new Promise<{ data: { session: null } }>(r =>
      setTimeout(() => r({ data: { session: null } }), 6000)
    )
    Promise.race([sessionPromise, sessionTimeout]).then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id, data.session.user.email)
        if (mounted) setUser(profile)
      }
      if (mounted) { clearTimeout(timeout); setLoading(false) }
    })

    // Subscribe to auth changes (sign in, sign out, token refresh)
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (newSession?.user) {
        const profile = await fetchProfile(newSession.user.id, newSession.user.email)
        if (mounted) setUser(profile)
      } else {
        setUser(null)
      }
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
