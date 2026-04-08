-- M13: user_sessions — application-level session tracking
-- Supabase Auth manages JWT sessions, but we want our own table so we can:
--   1. Show admins the list of currently active sessions
--   2. Force-revoke a session from the security dashboard
--   3. Track device and IP per session
--   4. Apply role-specific timeouts (12h admin, 8h employee, 30d client)

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip_address TEXT,
  last_active TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user   ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token  ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions (expires_at) WHERE is_active = true;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sessions" ON user_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users insert own sessions" ON user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own sessions or admin updates any" ON user_sessions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cleanup function: deactivate sessions past their expires_at
-- Called from daily pg_cron in M5.
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE is_active = true AND expires_at < now();
END;
$$;
