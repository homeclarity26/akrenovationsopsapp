-- K51: Inspection reports
CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID REFERENCES checklist_instance_items(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  inspection_type TEXT NOT NULL,
  conducted_by UUID REFERENCES profiles(id),
  conducted_at TIMESTAMPTZ DEFAULT now(),
  areas JSONB NOT NULL,
  overall_condition TEXT CHECK (overall_condition IN (
    'ready_to_proceed', 'minor_issues', 'major_issues', 'do_not_proceed'
  )),
  ai_summary TEXT,
  ai_flags JSONB,
  pdf_url TEXT,
  drive_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;

-- Admin and employees who conducted them
CREATE POLICY inspection_reports_admin_all ON inspection_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY inspection_reports_employee_select ON inspection_reports
  FOR SELECT TO authenticated
  USING (
    conducted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY inspection_reports_employee_insert ON inspection_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    conducted_by = auth.uid()
  );
