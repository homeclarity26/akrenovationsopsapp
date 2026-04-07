-- K8: Tool requests table
CREATE TABLE IF NOT EXISTS tool_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  tool_name TEXT NOT NULL,
  needed_by DATE,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'declined', 'purchased', 'on_site'
  )),
  admin_response TEXT,
  estimated_cost NUMERIC,
  purchase_location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tool_requests ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY tool_requests_admin_all ON tool_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Employees: can read and insert their own requests
CREATE POLICY tool_requests_employee_select ON tool_requests
  FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY tool_requests_employee_insert ON tool_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
  );
