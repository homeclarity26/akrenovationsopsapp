-- D1: Create agent_outputs table

CREATE TABLE IF NOT EXISTS agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('brief', 'draft', 'alert', 'report', 'action')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_outputs_agent_name ON agent_outputs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_created_at ON agent_outputs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_outputs_pending ON agent_outputs(requires_approval, approved_at, dismissed_at) WHERE requires_approval = true AND approved_at IS NULL AND dismissed_at IS NULL;

-- RLS: admin only
ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to agent_outputs"
  ON agent_outputs FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
