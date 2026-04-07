-- B3: Create budget_quotes table

CREATE TABLE IF NOT EXISTS budget_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES budget_trades(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  amount NUMERIC NOT NULL,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  scope_included TEXT,
  scope_excluded TEXT,
  includes_materials BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'awarded', 'declined')),
  awarded_at TIMESTAMPTZ,
  ai_analysis TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_quotes_trade_id ON budget_quotes(trade_id);
CREATE INDEX IF NOT EXISTS idx_budget_quotes_project_id ON budget_quotes(project_id);

-- RLS
ALTER TABLE budget_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to budget_quotes"
  ON budget_quotes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION update_budget_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_quotes_updated_at
  BEFORE UPDATE ON budget_quotes
  FOR EACH ROW EXECUTE FUNCTION update_budget_quotes_updated_at();
