-- E3: app_usage_events table (improvement engine tracking)

CREATE TABLE IF NOT EXISTS app_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  user_role TEXT NOT NULL,
  screen TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  time_on_screen_seconds INTEGER,
  session_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user ON app_usage_events(user_id, screen, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_screen ON app_usage_events(screen, action, created_at DESC);

ALTER TABLE app_usage_events ENABLE ROW LEVEL SECURITY;

-- Admin can read all usage events
CREATE POLICY "Admin read all usage events"
  ON app_usage_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Any authenticated user can insert their own events
CREATE POLICY "Users insert own usage events"
  ON app_usage_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
