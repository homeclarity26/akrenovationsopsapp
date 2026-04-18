-- Bring scratch DB to parity with prod for the columns+tables our tests need.
-- Tolerant (IF NOT EXISTS throughout). Applied to scratch only.

-- companies: missing columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS services_offered TEXT[];
ALTER TABLE companies ADD COLUMN IF NOT EXISTS service_area TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS insurance_info TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS years_in_business INT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS preferred_communication TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_hours JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT;

-- profiles: missing column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- messages: missing column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sms_sid TEXT;

-- inspection_reports: missing columns
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS inspection_date DATE;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS inspector_name TEXT;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS inspector_org TEXT;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS result TEXT DEFAULT 'pending';
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS follow_up_required BOOL DEFAULT false;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- suppliers: missing columns
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS primary_contact_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS preferred BOOL DEFAULT false;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOL DEFAULT true;

-- shopping_list_items: missing columns
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS inventory_item_id UUID;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS source_location_id UUID;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS deducted_at TIMESTAMPTZ;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS deducted_stocktake_id UUID;

-- inventory_categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_locations
CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  type TEXT,
  assigned_to UUID,
  license_plate TEXT,
  notes TEXT,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  sku TEXT,
  category_id UUID,
  vendor TEXT,
  pack_size TEXT,
  unit TEXT,
  target_stock_total INT,
  min_stock_alert INT,
  notes TEXT,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_item_templates
CREATE TABLE IF NOT EXISTS inventory_item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  name TEXT NOT NULL,
  category_name TEXT,
  typical_vendor TEXT,
  typical_pack_size TEXT,
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_stock
CREATE TABLE IF NOT EXISTS inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID,
  location_id UUID,
  quantity NUMERIC DEFAULT 0,
  last_counted_at TIMESTAMPTZ,
  last_counted_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_stocktakes
CREATE TABLE IF NOT EXISTS inventory_stocktakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID,
  location_id UUID,
  quantity_before NUMERIC,
  quantity_after NUMERIC,
  delta NUMERIC,
  counted_by UUID,
  source TEXT,
  confidence NUMERIC,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- inventory_alerts
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  item_id UUID,
  alert_type TEXT,
  current_total NUMERIC,
  threshold NUMERIC,
  summary TEXT,
  recommendation TEXT,
  status TEXT DEFAULT 'open',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- project_reels
CREATE TABLE IF NOT EXISTS project_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  title TEXT,
  narrative TEXT,
  manifest JSONB,
  generated_by UUID,
  visible_to_client BOOL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- supplier_contacts
CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID,
  full_name TEXT,
  title TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- integrations table (commonly checked)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  is_active BOOL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS defaults so queries don't break
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['inventory_categories','inventory_locations','inventory_items','inventory_item_templates','inventory_stock','inventory_stocktakes','inventory_alerts','project_reels','supplier_contacts','integrations']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY IF NOT EXISTS "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
