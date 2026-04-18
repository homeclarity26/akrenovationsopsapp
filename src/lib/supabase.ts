// Real Supabase client.
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Vercel env vars.
// Falls back to empty strings if not set (demo routes never touch this).

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''

/**
 * Disable the gotrue-js navigator-lock entirely.
 *
 * Background: gotrue-js v2 serializes every `_useSession()` call (used
 * internally before every `.from(...)` REST request) behind a
 * `navigator.locks` mutex keyed on `lock:sb-<project>-auth-token`. React
 * StrictMode mounts AuthProvider twice on boot; the first mount acquires
 * this lock, the unmount-before-remount never releases it, and every
 * `.from(...)` call afterwards blocks forever. gotrue-js logs
 * "Lock ... was not released within 5000ms. Forcefully acquiring the
 * lock to recover." — but the forced recovery doesn't unwedge downstream
 * callers. That's the bug that made every data-bound page stuck in a
 * loading skeleton on 2026-04-18.
 *
 * Passing a no-op lock tells gotrue-js to just run its session work
 * directly. Two concurrent refreshes across tabs could in theory race,
 * but this app is a single-operator tool; worst case a refresh retries.
 * See E2E_REPORT_2026-04-19.md for the full diagnosis.
 */
const noLock = <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so refreshes stay logged in
    persistSession: true,
    // Auto-refresh the JWT in the background
    autoRefreshToken: true,
    // Detect the session in the URL after OAuth callbacks
    detectSessionInUrl: true,
    // See the noLock explainer above.
    lock: noLock,
  },
})
