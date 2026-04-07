-- I7: mileage_logs — for future per-mile reimbursement (built now, used later)

CREATE TABLE IF NOT EXISTS mileage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  miles NUMERIC NOT NULL,
  origin TEXT,
  destination TEXT,
  purpose TEXT,
  irs_rate NUMERIC,
  reimbursement_amount NUMERIC,
  pay_period_id UUID REFERENCES pay_periods(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mileage_logs_profile ON mileage_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_period ON mileage_logs(pay_period_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_date ON mileage_logs(log_date);
