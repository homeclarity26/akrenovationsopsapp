-- I2: compensation_components — recurring pay line items per worker

CREATE TABLE IF NOT EXISTS compensation_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  component_type TEXT NOT NULL CHECK (component_type IN (
    'base_salary',
    'hourly_base',
    'vehicle_allowance',
    'health_employer',
    'retirement_employer',
    'phone_stipend',
    'tool_allowance',
    'other_recurring'
  )),

  amount NUMERIC NOT NULL,
  amount_frequency TEXT NOT NULL CHECK (amount_frequency IN (
    'per_hour',
    'per_pay_period',
    'monthly',
    'annual'
  )),

  is_taxable BOOLEAN DEFAULT true,
  is_pre_tax BOOLEAN DEFAULT false,
  irs_code TEXT,

  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_components_profile ON compensation_components(profile_id);
CREATE INDEX IF NOT EXISTS idx_comp_components_active ON compensation_components(profile_id, is_active);

CREATE OR REPLACE FUNCTION update_comp_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comp_components_updated_at ON compensation_components;
CREATE TRIGGER comp_components_updated_at
  BEFORE UPDATE ON compensation_components
  FOR EACH ROW EXECUTE FUNCTION update_comp_components_updated_at();
