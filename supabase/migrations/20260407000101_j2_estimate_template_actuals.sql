-- J2: estimate_template_actuals — actual project costs fed back into template calibration

CREATE TABLE IF NOT EXISTS estimate_template_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES estimate_templates(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actual_total_cost NUMERIC NOT NULL,
  actual_contract_value NUMERIC NOT NULL,
  actual_duration_weeks NUMERIC,
  actual_unit_costs JSONB,
  actual_trade_breakdown JSONB,
  finish_level_actual TEXT,
  sqft_actual INTEGER,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_template_actuals_template ON estimate_template_actuals(template_id);
CREATE INDEX IF NOT EXISTS idx_estimate_template_actuals_project ON estimate_template_actuals(project_id);

ALTER TABLE estimate_template_actuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to estimate_template_actuals" ON estimate_template_actuals;
CREATE POLICY "Admin full access to estimate_template_actuals"
  ON estimate_template_actuals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
