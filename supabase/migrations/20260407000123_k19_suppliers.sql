-- K19: Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'lumber_building', 'plumbing', 'electrical', 'tile_flooring',
    'cabinets', 'countertops', 'appliances', 'paint', 'hvac',
    'hardware', 'rental', 'dumpster', 'concrete', 'roofing',
    'windows_doors', 'other'
  )),
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'OH',
  account_number TEXT,
  contractor_discount_percent NUMERIC,
  payment_terms TEXT,
  credit_limit NUMERIC,
  annual_spend NUMERIC,
  rep_name TEXT,
  rep_phone TEXT,
  rep_email TEXT,
  notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_preferred BOOLEAN DEFAULT false,
  referral_source_id UUID REFERENCES leads(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Admin only — never expose supplier account/discount data to employees or clients
CREATE POLICY suppliers_admin_all ON suppliers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
