-- E2: meta_agent_preferences table

CREATE TABLE IF NOT EXISTS meta_agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_type TEXT NOT NULL CHECK (preference_type IN (
    'communication_style', 'decision_pattern', 'workflow_preference',
    'business_priority', 'pain_point', 'time_pattern'
  )),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.8,
  evidence TEXT,
  inferred_at TIMESTAMPTZ DEFAULT now(),
  confirmed_by_adam BOOLEAN DEFAULT false,
  UNIQUE(preference_type, key)
);

ALTER TABLE meta_agent_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only meta_agent_preferences"
  ON meta_agent_preferences FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
