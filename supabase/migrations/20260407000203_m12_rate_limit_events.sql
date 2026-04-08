-- M12: rate_limit_events — track requests per identifier per endpoint

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for the rate limit window query (most frequent path)
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON rate_limit_events (identifier, endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked
  ON rate_limit_events (blocked, created_at DESC) WHERE blocked = true;

ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Admin-only read access. Edge functions use the service-role key to write,
-- which bypasses RLS automatically — no INSERT policy needed for them.
CREATE POLICY "Admin reads rate_limit_events" ON rate_limit_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Cleanup function: delete records older than 24 hours.
-- Called from a daily pg_cron job in M5.
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_events()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM rate_limit_events
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$;
