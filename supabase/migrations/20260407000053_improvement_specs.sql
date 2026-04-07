-- E4: improvement_specs table

CREATE TABLE IF NOT EXISTS improvement_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  evidence TEXT NOT NULL,
  proposed_solution TEXT NOT NULL,
  spec_content TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT CHECK (category IN (
    'ux_friction', 'missing_feature', 'agent_improvement',
    'workflow_optimization', 'data_quality', 'performance'
  )),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'reviewed', 'approved', 'in_progress', 'deployed', 'dismissed'
  )),
  adam_notes TEXT,
  deployed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_improvement_specs_status ON improvement_specs(status);
CREATE INDEX IF NOT EXISTS idx_improvement_specs_priority ON improvement_specs(priority, status);

ALTER TABLE improvement_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only improvement_specs"
  ON improvement_specs FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION update_improvement_specs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER improvement_specs_updated_at
  BEFORE UPDATE ON improvement_specs
  FOR EACH ROW EXECUTE FUNCTION update_improvement_specs_updated_at();
