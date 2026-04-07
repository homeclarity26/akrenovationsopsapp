-- H16: Create compliance_items table

CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'business_registration',
    'licensing',
    'insurance',
    'tax',
    'employment',
    'safety',
    'bonding',
    'permits',
    'banking',
    'contracts',
    'website_digital'
  )),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN (
    'federal', 'ohio_state', 'summit_county', 'city', 'other'
  )),
  city TEXT,

  -- Item details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_required TEXT,
  how_to_complete TEXT,
  where_to_go TEXT,
  estimated_cost TEXT,
  estimated_time TEXT,
  frequency TEXT CHECK (frequency IN (
    'one_time', 'annual', 'biennial', 'monthly', 'quarterly', 'as_needed'
  )),

  -- Status tracking
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started',
    'in_progress',
    'completed',
    'not_applicable',
    'needs_renewal'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN (
    'critical',
    'high',
    'medium',
    'low'
  )),

  -- Dates
  completed_at TIMESTAMPTZ,
  expiry_date DATE,
  renewal_reminder_days INTEGER DEFAULT 60,

  -- Documents
  document_url TEXT,
  account_number TEXT,
  notes TEXT,

  -- AI assistance
  ai_help_available BOOLEAN DEFAULT true,
  ai_help_prompt TEXT,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_items_category ON compliance_items(category);
CREATE INDEX IF NOT EXISTS idx_compliance_items_status ON compliance_items(status);
CREATE INDEX IF NOT EXISTS idx_compliance_items_priority ON compliance_items(priority);
CREATE INDEX IF NOT EXISTS idx_compliance_items_expiry_date ON compliance_items(expiry_date);

CREATE OR REPLACE FUNCTION update_compliance_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compliance_items_updated_at ON compliance_items;
CREATE TRIGGER compliance_items_updated_at
  BEFORE UPDATE ON compliance_items
  FOR EACH ROW EXECUTE FUNCTION update_compliance_items_updated_at();

-- RLS — admin only (business compliance is sensitive)
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to compliance_items"
  ON compliance_items FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
