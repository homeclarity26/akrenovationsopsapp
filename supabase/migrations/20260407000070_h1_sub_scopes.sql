-- H1: Create sub_scopes table + sequence + trigger

CREATE TABLE IF NOT EXISTS sub_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_trade_id UUID REFERENCES budget_trades(id),
  budget_quote_id UUID REFERENCES budget_quotes(id),
  subcontractor_id UUID REFERENCES subcontractors(id),

  -- Document identity
  scope_number TEXT UNIQUE,
  trade TEXT NOT NULL,
  revision INTEGER DEFAULT 1,

  -- Content
  scope_sections JSONB NOT NULL,
  scope_plain_text TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'reviewed',
    'sent',
    'acknowledged',
    'superseded'
  )),

  -- Files
  pdf_url TEXT,
  drive_url TEXT,
  docx_url TEXT,

  -- Metadata
  ai_generated BOOLEAN DEFAULT true,
  generation_notes TEXT,
  attorney_reviewed BOOLEAN DEFAULT false,
  attorney_reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_scopes_project_id ON sub_scopes(project_id);
CREATE INDEX IF NOT EXISTS idx_sub_scopes_subcontractor_id ON sub_scopes(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sub_scopes_budget_quote_id ON sub_scopes(budget_quote_id);
CREATE INDEX IF NOT EXISTS idx_sub_scopes_status ON sub_scopes(status);

-- Auto-increment scope number
CREATE SEQUENCE IF NOT EXISTS scope_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_scope_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scope_number IS NULL THEN
    NEW.scope_number := 'SOW-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('scope_number_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_scope_number ON sub_scopes;
CREATE TRIGGER set_scope_number
  BEFORE INSERT ON sub_scopes
  FOR EACH ROW EXECUTE FUNCTION generate_scope_number();

CREATE OR REPLACE FUNCTION update_sub_scopes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sub_scopes_updated_at ON sub_scopes;
CREATE TRIGGER sub_scopes_updated_at
  BEFORE UPDATE ON sub_scopes
  FOR EACH ROW EXECUTE FUNCTION update_sub_scopes_updated_at();

-- RLS — admin only (financial/sub-facing document)
ALTER TABLE sub_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to sub_scopes"
  ON sub_scopes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
