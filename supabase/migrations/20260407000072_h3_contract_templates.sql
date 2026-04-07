-- H3: Create contract_templates table

CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL DEFAULT 'subcontractor_agreement',
  version TEXT NOT NULL,
  content JSONB NOT NULL,
  attorney_approved BOOLEAN DEFAULT false,
  attorney_approved_at TIMESTAMPTZ,
  attorney_name TEXT,
  is_current BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_is_current ON contract_templates(is_current);

-- Only one current version per template_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_templates_one_current
  ON contract_templates(template_type)
  WHERE is_current = true;

-- RLS — admin only
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to contract_templates"
  ON contract_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
