-- I6: payroll_adjustments — one-time additions/deductions within a pay period

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id UUID REFERENCES payroll_records(id) ON DELETE CASCADE,
  pay_period_id UUID NOT NULL REFERENCES pay_periods(id),
  profile_id UUID NOT NULL REFERENCES profiles(id),

  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'bonus',
    'commission',
    'expense_reimbursement',
    'advance',
    'advance_repayment',
    'correction',
    'garnishment',
    'other_addition',
    'other_deduction'
  )),

  amount NUMERIC NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  description TEXT NOT NULL,
  reference_id UUID,
  project_id UUID REFERENCES projects(id),

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_record ON payroll_adjustments(payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments(pay_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_profile ON payroll_adjustments(profile_id);
