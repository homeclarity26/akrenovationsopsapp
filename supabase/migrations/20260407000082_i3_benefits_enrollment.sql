-- I3: benefits_enrollment — health, retirement, etc. per worker

CREATE TABLE IF NOT EXISTS benefits_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  benefit_type TEXT NOT NULL CHECK (benefit_type IN (
    'health',
    'dental',
    'vision',
    'retirement_simple_ira',
    'retirement_401k',
    'life_insurance',
    'other'
  )),
  plan_name TEXT,
  carrier TEXT,

  -- Employee portion (deducted from paycheck)
  employee_contribution_amount NUMERIC DEFAULT 0,
  employee_contribution_frequency TEXT DEFAULT 'per_pay_period'
    CHECK (employee_contribution_frequency IN ('per_pay_period', 'monthly', 'annual', 'percent_of_gross')),

  -- Employer portion (company cost, not deducted from employee)
  employer_contribution_amount NUMERIC DEFAULT 0,
  employer_contribution_frequency TEXT DEFAULT 'per_pay_period'
    CHECK (employer_contribution_frequency IN ('per_pay_period', 'monthly', 'annual', 'percent_of_gross')),

  -- Retirement: contribution as % of gross
  employee_contribution_percent NUMERIC,
  employer_match_percent NUMERIC,
  employer_match_cap_percent NUMERIC,

  is_pre_tax BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benefits_profile ON benefits_enrollment(profile_id);
CREATE INDEX IF NOT EXISTS idx_benefits_active ON benefits_enrollment(profile_id, is_active);

CREATE OR REPLACE FUNCTION update_benefits_enrollment_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS benefits_enrollment_updated_at ON benefits_enrollment;
CREATE TRIGGER benefits_enrollment_updated_at
  BEFORE UPDATE ON benefits_enrollment
  FOR EACH ROW EXECUTE FUNCTION update_benefits_enrollment_updated_at();
