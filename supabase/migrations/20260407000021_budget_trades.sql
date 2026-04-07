-- B2: Create budget_trades table

CREATE TABLE IF NOT EXISTS budget_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_category TEXT NOT NULL CHECK (trade_category IN ('structural', 'exterior', 'mep', 'interior_subs', 'crew', 'other')),
  budget_amount NUMERIC NOT NULL DEFAULT 0,
  awarded_amount NUMERIC,
  awarded_subcontractor_id UUID REFERENCES subcontractors(id),
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_trades_project_id ON budget_trades(project_id);

-- RLS
ALTER TABLE budget_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to budget_trades"
  ON budget_trades FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_budget_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_trades_updated_at
  BEFORE UPDATE ON budget_trades
  FOR EACH ROW EXECUTE FUNCTION update_budget_trades_updated_at();
