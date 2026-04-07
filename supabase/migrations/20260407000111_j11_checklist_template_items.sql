-- J11: checklist_template_items — items within each checklist template

CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_role TEXT NOT NULL CHECK (assigned_role IN ('admin', 'employee', 'any')),
  due_days_from_trigger INTEGER,
  due_days_after_item UUID,
  is_required BOOLEAN DEFAULT true,
  requires_upload BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  requires_note BOOLEAN DEFAULT false,
  ai_help_available BOOLEAN DEFAULT false,
  ai_help_prompt TEXT,
  external_link TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template ON checklist_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_sort ON checklist_template_items(template_id, sort_order);

ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to checklist_template_items" ON checklist_template_items;
CREATE POLICY "Admin full access to checklist_template_items"
  ON checklist_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employee read checklist_template_items" ON checklist_template_items;
CREATE POLICY "Employee read checklist_template_items"
  ON checklist_template_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'employee'))
  );
