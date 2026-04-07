-- E1: meta_agent_conversations table

CREATE TABLE IF NOT EXISTS meta_agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_conv_session ON meta_agent_conversations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meta_conv_created ON meta_agent_conversations(created_at DESC);

ALTER TABLE meta_agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only meta_agent_conversations"
  ON meta_agent_conversations FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
