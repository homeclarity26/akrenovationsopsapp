-- J10: checklist_templates — master checklist template definitions

CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'marketing',
    'sales_prep',
    'sales_call',
    'client_meeting',
    'client_onboarding',
    'project_kickoff',
    'project_sop',
    'project_closeout',
    'post_project',
    'employee_onboarding',
    'subcontractor_onboarding',
    'compliance'
  )),
  project_type TEXT,
  applies_to_role TEXT[] DEFAULT ARRAY['admin'],
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'manual',
    'lead_created',
    'consultation_scheduled',
    'proposal_sent',
    'contract_signed',
    'project_started',
    'project_phase_change',
    'project_complete',
    'employee_hired',
    'sub_awarded'
  )),
  trigger_phase TEXT,
  due_days_from_trigger INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_trigger ON checklist_templates(trigger_event);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON checklist_templates(category);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_active ON checklist_templates(is_active);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to checklist_templates" ON checklist_templates;
CREATE POLICY "Admin full access to checklist_templates"
  ON checklist_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employee read checklist_templates" ON checklist_templates;
CREATE POLICY "Employee read checklist_templates"
  ON checklist_templates FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'employee'))
  );
