-- J3: estimate_line_items — reusable scope line items library for proposals

CREATE TABLE IF NOT EXISTS estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES estimate_templates(id) ON DELETE SET NULL,
  project_type TEXT,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  unit_cost_min NUMERIC,
  unit_cost_max NUMERIC,
  unit_cost_typical NUMERIC,
  is_standard BOOLEAN DEFAULT true,
  is_optional BOOLEAN DEFAULT false,
  trade TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_template ON estimate_line_items(template_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_project_type ON estimate_line_items(project_type);

ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to estimate_line_items" ON estimate_line_items;
CREATE POLICY "Admin full access to estimate_line_items"
  ON estimate_line_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
