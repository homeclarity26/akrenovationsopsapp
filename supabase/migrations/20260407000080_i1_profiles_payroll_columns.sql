-- I1: Add payroll columns to existing profiles table

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS worker_type TEXT
  DEFAULT 'w2_fulltime'
  CHECK (worker_type IN ('w2_fulltime', 'w2_parttime', 'contractor_1099', 'owner'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pay_type TEXT
  CHECK (pay_type IN ('salary', 'hourly'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS annual_salary NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS standard_hours_per_week NUMERIC DEFAULT 40;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overtime_eligible BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pay_frequency TEXT DEFAULT 'biweekly';

-- Filing status (used for federal withholding estimates)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS filing_status TEXT
  CHECK (filing_status IN ('single', 'married_jointly', 'married_separately', 'head_of_household'));

-- Ohio SUTA rate (employer state unemployment) — varies per company
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suta_rate NUMERIC DEFAULT 0.027;

-- Gusto sync IDs (set after Gusto employee/contractor creation)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gusto_employee_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gusto_contractor_id TEXT;
