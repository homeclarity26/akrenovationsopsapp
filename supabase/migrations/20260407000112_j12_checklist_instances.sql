-- J12: checklist_instances — generated checklists attached to entities

CREATE TABLE IF NOT EXISTS checklist_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id),
  template_name TEXT NOT NULL,

  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'project', 'lead', 'employee', 'subcontractor', 'general'
  )),
  entity_id UUID NOT NULL,

  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'skipped', 'archived'
  )),
  completion_percent INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,

  triggered_by TEXT NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  due_date DATE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_instances_entity ON checklist_instances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_template ON checklist_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);

-- Uniqueness guard: do not generate the same (template, entity_type, entity_id) twice while active
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_instances_unique_active
  ON checklist_instances(template_id, entity_type, entity_id)
  WHERE status = 'active';

ALTER TABLE checklist_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to checklist_instances" ON checklist_instances;
CREATE POLICY "Admin full access to checklist_instances"
  ON checklist_instances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employee read checklist_instances" ON checklist_instances;
CREATE POLICY "Employee read checklist_instances"
  ON checklist_instances FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'employee'))
  );
