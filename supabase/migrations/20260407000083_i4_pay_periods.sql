-- I4: pay_periods — every other Friday for the year

CREATE TABLE IF NOT EXISTS pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  period_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN (
    'upcoming',
    'open',
    'processing',
    'submitted',
    'paid',
    'closed'
  )),
  gusto_payroll_id TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_pay_periods_year ON pay_periods(year);
CREATE INDEX IF NOT EXISTS idx_pay_periods_status ON pay_periods(status);
CREATE INDEX IF NOT EXISTS idx_pay_periods_pay_date ON pay_periods(pay_date);
