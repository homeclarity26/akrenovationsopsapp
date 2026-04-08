-- API usage log — tracks every AI/API call with cost
CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL CHECK (service IN ('anthropic', 'gemini', 'resend', 'supabase', 'stripe', 'twilio', 'other')),
  model TEXT,                              -- e.g. 'claude-sonnet-4-20250514', 'gemini-embedding-001'
  agent_name TEXT,                         -- which agent or function made the call
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  units NUMERIC DEFAULT 0,                 -- for non-token APIs: emails sent, SMS sent, etc.
  cost_usd NUMERIC(10,6) DEFAULT 0,        -- calculated cost in USD
  metadata JSONB,                          -- optional: session_id, project_id, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_log_created_at_idx ON api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_log_service_idx ON api_usage_log(service);
CREATE INDEX IF NOT EXISTS api_usage_log_agent_name_idx ON api_usage_log(agent_name);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON api_usage_log FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
