-- E5: agent_directives table (meta agent controls other agents)

CREATE TABLE IF NOT EXISTS agent_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  directive_type TEXT NOT NULL CHECK (directive_type IN (
    'pause', 'resume', 'frequency_change', 'parameter_change', 'chain', 'condition'
  )),
  directive_value JSONB NOT NULL,
  reason TEXT,
  issued_by TEXT DEFAULT 'meta_agent',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_directives_agent ON agent_directives(agent_name, active);

ALTER TABLE agent_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only agent_directives"
  ON agent_directives FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
