// Test environment setup
// Uses staging Supabase project, not production.
// To run DB-dependent tests, set up a staging project and provide:
//   VITE_SUPABASE_URL=<staging url>
//   VITE_SUPABASE_ANON_KEY=<staging anon key>
import { createClient } from '@supabase/supabase-js';

const STAGING_URL = process.env.VITE_SUPABASE_URL || '';
const STAGING_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export const testSupabase = createClient(STAGING_URL, STAGING_KEY);

// Clean up test data after each test
afterEach(async () => {
  // Tests that create data should clean up in their own afterEach blocks.
  // This is a safety net only.
});
