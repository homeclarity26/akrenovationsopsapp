-- B4: Create budget_settings table (one row per project)

CREATE TABLE IF NOT EXISTS budget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,

  -- Sub markup
  sub_markup_percent NUMERIC NOT NULL DEFAULT 0.25,

  -- PM fee
  pm_hours_per_week NUMERIC NOT NULL DEFAULT 10,
  pm_rate_per_hour NUMERIC NOT NULL DEFAULT 120,

  -- Crew cost
  crew_weeks_on_site NUMERIC NOT NULL DEFAULT 3.5,
  crew_weekly_cost NUMERIC NOT NULL DEFAULT 3300,
  crew_bill_multiplier NUMERIC NOT NULL DEFAULT 2.0,

  -- Duration & overhead
  duration_weeks NUMERIC NOT NULL DEFAULT 18,
  monthly_overhead NUMERIC NOT NULL DEFAULT 5000,

  -- Contingency
  contingency_amount NUMERIC NOT NULL DEFAULT 5000,

  -- Lock state
  final_contract_price NUMERIC,
  final_locked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE budget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to budget_settings"
  ON budget_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION update_budget_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_settings_updated_at
  BEFORE UPDATE ON budget_settings
  FOR EACH ROW EXECUTE FUNCTION update_budget_settings_updated_at();
