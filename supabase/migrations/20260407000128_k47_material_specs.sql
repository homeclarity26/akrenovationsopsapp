-- K47: Material specs library
CREATE TABLE IF NOT EXISTS material_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'cabinets', 'countertops', 'tile_floor', 'tile_wall',
    'hardwood', 'lvp', 'carpet', 'plumbing_fixtures',
    'light_fixtures', 'hardware', 'appliances', 'windows',
    'doors_interior', 'doors_exterior', 'paint', 'other'
  )),
  subcategory TEXT,
  brand TEXT,
  product_name TEXT NOT NULL,
  product_line TEXT,
  sku TEXT,
  unit TEXT NOT NULL,
  price_min NUMERIC,
  price_max NUMERIC,
  price_typical NUMERIC,
  price_source TEXT,
  price_updated_at DATE,
  supplier_id UUID REFERENCES suppliers(id),
  product_url TEXT,
  notes TEXT,
  finish_level TEXT CHECK (finish_level IN ('builder', 'mid_range', 'high_end', 'luxury')),
  is_preferred BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  times_specified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE material_specs ENABLE ROW LEVEL SECURITY;

-- Admin only — pricing data
CREATE POLICY material_specs_admin_all ON material_specs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
