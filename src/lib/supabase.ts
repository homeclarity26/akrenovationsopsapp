// src/lib/supabase.ts
// Supabase client stub — replace with real @supabase/supabase-js client once the package is installed.
// npm install @supabase/supabase-js

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Lightweight stub that mirrors the Supabase client API surface used in this app.
// All methods are no-ops until the real package is installed.
function createStubClient(_url: string, _key: string) {
  const from = (_table: string) => ({
    insert: async (_data: unknown) => ({ data: null, error: null }),
    select: (_cols?: string) => ({
      eq: (_col: string, _val: unknown) => ({
        single: async () => ({ data: null, error: null }),
      }),
    }),
  })
  const storage = {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: unknown) => ({ data: null, error: null }),
    }),
  }
  const functions = {
    invoke: async (_name: string, _opts?: unknown) => ({ data: null, error: null }),
  }
  return { from, storage, functions }
}

export const supabase = createStubClient(supabaseUrl, supabaseAnonKey)
