-- F3: Work type billing rates per user

CREATE TABLE work_type_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  work_type TEXT NOT NULL CHECK (work_type IN (
    'field_carpentry',
    'project_management',
    'site_visit',
    'design',
    'administrative',
    'travel',
    'other'
  )),
  rate_per_hour NUMERIC NOT NULL DEFAULT 0,
  is_default_billable BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, work_type, effective_from)
);

CREATE INDEX idx_work_type_rates_user ON work_type_rates (user_id);
