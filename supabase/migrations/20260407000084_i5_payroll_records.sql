-- I5: payroll_records — one row per worker per pay period

CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  worker_type TEXT NOT NULL,

  -- Hours
  regular_hours NUMERIC DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  pto_hours NUMERIC DEFAULT 0,
  holiday_hours NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,

  -- Gross pay components
  base_pay NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  vehicle_allowance NUMERIC DEFAULT 0,
  phone_stipend NUMERIC DEFAULT 0,
  other_allowances NUMERIC DEFAULT 0,
  bonus_amount NUMERIC DEFAULT 0,
  gross_pay NUMERIC DEFAULT 0,

  -- Deductions (employee share)
  health_deduction NUMERIC DEFAULT 0,
  retirement_deduction NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,

  -- Employer costs
  employer_health_cost NUMERIC DEFAULT 0,
  employer_retirement_cost NUMERIC DEFAULT 0,
  employer_ss_tax NUMERIC DEFAULT 0,
  employer_medicare_tax NUMERIC DEFAULT 0,
  employer_futa NUMERIC DEFAULT 0,
  employer_suta NUMERIC DEFAULT 0,
  total_employer_cost NUMERIC DEFAULT 0,

  -- Estimated withholdings (Gusto calculates exact)
  est_federal_withholding NUMERIC DEFAULT 0,
  est_state_withholding NUMERIC DEFAULT 0,
  est_employee_ss NUMERIC DEFAULT 0,
  est_employee_medicare NUMERIC DEFAULT 0,
  est_net_pay NUMERIC DEFAULT 0,

  -- 1099 contractors
  contractor_payment NUMERIC DEFAULT 0,
  contractor_payment_memo TEXT,

  -- Status
  status TEXT DEFAULT 'calculated' CHECK (status IN (
    'calculated',
    'reviewed',
    'approved',
    'submitted',
    'paid'
  )),
  review_notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Gusto sync
  gusto_employee_compensation_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(pay_period_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(pay_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_profile ON payroll_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);

CREATE OR REPLACE FUNCTION update_payroll_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_records_updated_at ON payroll_records;
CREATE TRIGGER payroll_records_updated_at
  BEFORE UPDATE ON payroll_records
  FOR EACH ROW EXECUTE FUNCTION update_payroll_records_updated_at();
