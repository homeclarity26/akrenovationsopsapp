-- J13: checklist_instance_items — individual tasks within a checklist instance

CREATE TABLE IF NOT EXISTS checklist_instance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES checklist_template_items(id),

  title TEXT NOT NULL,
  description TEXT,
  assigned_role TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),

  due_date DATE,
  is_required BOOLEAN DEFAULT true,

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'skipped', 'blocked'
  )),
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  completion_note TEXT,
  uploaded_file_url TEXT,

  ai_help_available BOOLEAN DEFAULT false,
  ai_help_prompt TEXT,
  external_link TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_items_instance ON checklist_instance_items(instance_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instance_items_assignee ON checklist_instance_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_checklist_instance_items_status ON checklist_instance_items(status);

ALTER TABLE checklist_instance_items ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS "Admin full access to checklist_instance_items" ON checklist_instance_items;
CREATE POLICY "Admin full access to checklist_instance_items"
  ON checklist_instance_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Employee: read items assigned to them or their role
DROP POLICY IF EXISTS "Employee read own checklist items" ON checklist_instance_items;
CREATE POLICY "Employee read own checklist items"
  ON checklist_instance_items FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR (
      assigned_role IN ('employee', 'any')
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
    )
  );

-- Employee: update items assigned to them (to mark complete, add notes)
DROP POLICY IF EXISTS "Employee update own checklist items" ON checklist_instance_items;
CREATE POLICY "Employee update own checklist items"
  ON checklist_instance_items FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR (
      assigned_role IN ('employee', 'any')
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
    )
  );
