-- J1: estimate_templates — master cost-range templates per project type

CREATE TABLE IF NOT EXISTS estimate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL CHECK (project_type IN (
    'kitchen', 'bathroom', 'addition', 'basement',
    'first_floor', 'master_suite', 'full_renovation', 'exterior'
  )),
  name TEXT NOT NULL,
  description TEXT,
  size_range_min_sqft INTEGER,
  size_range_max_sqft INTEGER,
  finish_level TEXT CHECK (finish_level IN (
    'builder', 'mid_range', 'high_end', 'luxury'
  )),

  total_cost_min NUMERIC NOT NULL,
  total_cost_max NUMERIC NOT NULL,
  total_cost_typical NUMERIC NOT NULL,

  unit_costs JSONB NOT NULL,
  trade_breakdown JSONB NOT NULL,

  duration_weeks_min INTEGER,
  duration_weeks_max INTEGER,
  duration_weeks_typical INTEGER,

  projects_count INTEGER DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,
  confidence_level TEXT DEFAULT 'industry' CHECK (confidence_level IN (
    'industry', 'regional', 'actual'
  )),

  is_active BOOLEAN DEFAULT true,
  effective_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_templates_project_type ON estimate_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_active ON estimate_templates(is_active);

ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to estimate_templates" ON estimate_templates;
CREATE POLICY "Admin full access to estimate_templates"
  ON estimate_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
