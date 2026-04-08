// Real Supabase client.
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Vercel env vars.
// Falls back to empty strings if not set (demo routes never touch this).

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so refreshes stay logged in
    persistSession: true,
    // Auto-refresh the JWT in the background
    autoRefreshToken: true,
    // Detect the session in the URL after OAuth callbacks
    detectSessionInUrl: true,
  },
})
