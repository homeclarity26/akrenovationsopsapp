-- K31: Labor benchmarks
CREATE TABLE IF NOT EXISTS labor_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL,
  category TEXT NOT NULL,
  project_type TEXT,
  unit TEXT NOT NULL,
  unit_description TEXT,
  hours_min NUMERIC NOT NULL,
  hours_max NUMERIC NOT NULL,
  hours_typical NUMERIC NOT NULL,
  projects_count INTEGER DEFAULT 0,
  confidence_level TEXT DEFAULT 'industry',
  last_calibrated_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE labor_benchmarks ENABLE ROW LEVEL SECURITY;

-- Admin only (financial data)
CREATE POLICY labor_benchmarks_admin_all ON labor_benchmarks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- K32: Seed labor benchmarks
INSERT INTO labor_benchmarks (task_name, category, unit, hours_min, hours_max, hours_typical) VALUES
  ('Cabinet installation — upper', 'cabinets', 'per linear ft', 0.4, 0.8, 0.55),
  ('Cabinet installation — lower', 'cabinets', 'per linear ft', 0.3, 0.6, 0.45),
  ('Tile installation — floor', 'tile', 'per sqft', 0.15, 0.35, 0.22),
  ('Tile installation — wall/shower', 'tile', 'per sqft', 0.25, 0.55, 0.38),
  ('Tile installation — mosaic/pattern', 'tile', 'per sqft', 0.45, 0.90, 0.65),
  ('Hardwood floor installation', 'flooring', 'per sqft', 0.08, 0.18, 0.12),
  ('LVP installation', 'flooring', 'per sqft', 0.05, 0.12, 0.08),
  ('Base trim installation', 'trim', 'per linear ft', 0.12, 0.25, 0.17),
  ('Crown molding installation', 'trim', 'per linear ft', 0.20, 0.45, 0.30),
  ('Door installation — prehung', 'doors', 'per door', 1.5, 3.0, 2.0),
  ('Door installation — slab', 'doors', 'per door', 2.5, 5.0, 3.5),
  ('Drywall hanging', 'drywall', 'per sqft', 0.04, 0.09, 0.06),
  ('Light fixture installation', 'electrical', 'per fixture', 0.5, 1.5, 0.75),
  ('Vanity installation', 'plumbing', 'per vanity', 2.0, 4.0, 2.75),
  ('Shower door installation', 'glass', 'per door', 2.5, 5.0, 3.5),
  ('Countertop installation', 'countertops', 'per linear ft', 0.5, 1.0, 0.7),
  ('Backsplash tile', 'tile', 'per sqft', 0.20, 0.45, 0.30),
  ('Demo — kitchen', 'demo', 'per room', 8, 20, 13),
  ('Demo — bathroom', 'demo', 'per room', 4, 10, 6),
  ('Paint — walls', 'paint', 'per sqft wall area', 0.03, 0.07, 0.05),
  ('Caulk and touch-up', 'finish', 'per room', 1.5, 4.0, 2.5);
