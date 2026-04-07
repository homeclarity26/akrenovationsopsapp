-- I8: payroll_ytd — year-to-date accumulators per worker

CREATE TABLE IF NOT EXISTS payroll_ytd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  gross_pay_ytd NUMERIC DEFAULT 0,
  federal_withholding_ytd NUMERIC DEFAULT 0,
  state_withholding_ytd NUMERIC DEFAULT 0,
  employee_ss_ytd NUMERIC DEFAULT 0,
  employee_medicare_ytd NUMERIC DEFAULT 0,
  retirement_employee_ytd NUMERIC DEFAULT 0,
  retirement_employer_ytd NUMERIC DEFAULT 0,
  health_employee_ytd NUMERIC DEFAULT 0,
  health_employer_ytd NUMERIC DEFAULT 0,
  net_pay_ytd NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_ytd_profile_year ON payroll_ytd(profile_id, year);
