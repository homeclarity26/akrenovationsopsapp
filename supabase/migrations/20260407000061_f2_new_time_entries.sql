-- F2: New time_entries table (multi-project, multi-work-type, billing-aware)

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),           -- nullable: null = overhead/unbillable

  -- Work type
  work_type TEXT NOT NULL CHECK (work_type IN (
    'field_carpentry',
    'project_management',
    'site_visit',
    'design',
    'administrative',
    'travel',
    'other'
  )),
  work_description TEXT,

  -- Time
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  total_minutes INTEGER,

  -- Billing
  is_billable BOOLEAN NOT NULL DEFAULT true,
  billing_rate NUMERIC,
  billed_amount NUMERIC,
  billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN (
    'pending',
    'invoiced',
    'written_off',
    'na'
  )),
  invoice_id UUID REFERENCES invoices(id),

  -- Entry method
  entry_method TEXT NOT NULL DEFAULT 'live' CHECK (entry_method IN ('live', 'manual')),
  manual_reason TEXT,

  -- Location
  clock_in_lat NUMERIC,
  clock_in_lng NUMERIC,
  clock_out_lat NUMERIC,
  clock_out_lng NUMERIC,
  geofence_verified BOOLEAN,

  -- Approval (manual entries need admin sign-off)
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent two simultaneously open entries for the same user
CREATE UNIQUE INDEX one_open_entry_per_user
  ON time_entries (user_id)
  WHERE clock_out IS NULL;

-- Performance indexes
CREATE INDEX idx_time_entries_user_id ON time_entries (user_id);
CREATE INDEX idx_time_entries_project_id ON time_entries (project_id);
CREATE INDEX idx_time_entries_clock_in ON time_entries (clock_in DESC);
CREATE INDEX idx_time_entries_billing_status ON time_entries (billing_status) WHERE is_billable = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_time_entries_updated_at();
