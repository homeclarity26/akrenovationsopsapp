-- Phase 2: AI usage metering (Critical for pricing)
-- Tracks every AI agent invocation for cost monitoring and billing.

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  model_provider TEXT NOT NULL, -- 'anthropic', 'google', 'openai'
  model_name TEXT NOT NULL, -- 'claude-sonnet-4-20250514', 'gemini-2.5-flash', etc.
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_cents INTEGER, -- cost in cents for easy math
  duration_ms INTEGER,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view usage logs"
  ON ai_usage_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    AND company_id = ai_usage_logs.company_id)
  );

CREATE INDEX idx_ai_usage_company ON ai_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_ai_usage_function ON ai_usage_logs(function_name, created_at DESC);
