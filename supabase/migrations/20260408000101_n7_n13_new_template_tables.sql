-- Phase N: Universal Template System
-- N7-N13: Create new template tables + template_promotions log

-- N7: scope_templates
CREATE TABLE IF NOT EXISTS scope_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES scope_templates(id),
  is_variation BOOLEAN DEFAULT false,
  variation_name TEXT,
  finish_level TEXT CHECK (finish_level IN ('builder','mid_range','high_end','luxury')),
  scope_sections JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  change_log JSONB DEFAULT '[]',
  promoted_from_instance_id UUID,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scope_templates_trade ON scope_templates(trade);
CREATE INDEX IF NOT EXISTS idx_scope_templates_active ON scope_templates(is_active);

ALTER TABLE scope_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scope_templates_admin_all" ON scope_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- N8: proposal_templates
CREATE TABLE IF NOT EXISTS proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES proposal_templates(id),
  is_variation BOOLEAN DEFAULT false,
  variation_name TEXT,
  finish_level TEXT,
  overview_template TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  selections_template JSONB DEFAULT '[]',
  payment_schedule_template JSONB DEFAULT '[]',
  terms_template TEXT,
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  change_log JSONB DEFAULT '[]',
  promoted_from_instance_id UUID,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_templates_project_type ON proposal_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_active ON proposal_templates(is_active);

ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_templates_admin_all" ON proposal_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- N9: punch_list_templates
CREATE TABLE IF NOT EXISTS punch_list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES punch_list_templates(id),
  is_variation BOOLEAN DEFAULT false,
  variation_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  change_log JSONB DEFAULT '[]',
  promoted_from_instance_id UUID,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_list_templates_project_type ON punch_list_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_punch_list_templates_active ON punch_list_templates(is_active);

ALTER TABLE punch_list_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "punch_list_templates_admin_all" ON punch_list_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- N10: payment_schedule_templates
CREATE TABLE IF NOT EXISTS payment_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES payment_schedule_templates(id),
  is_variation BOOLEAN DEFAULT false,
  variation_name TEXT,
  milestones JSONB NOT NULL DEFAULT '[]',
  retention_percent NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  change_log JSONB DEFAULT '[]',
  promoted_from_instance_id UUID,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_templates_project_type ON payment_schedule_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_templates_active ON payment_schedule_templates(is_active);

ALTER TABLE payment_schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_schedule_templates_admin_all" ON payment_schedule_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- N11: inspection_form_templates
CREATE TABLE IF NOT EXISTS inspection_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type TEXT NOT NULL,
  project_type TEXT,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES inspection_form_templates(id),
  is_variation BOOLEAN DEFAULT false,
  variation_name TEXT,
  areas JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  change_log JSONB DEFAULT '[]',
  promoted_from_instance_id UUID,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_form_templates_type ON inspection_form_templates(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspection_form_templates_active ON inspection_form_templates(is_active);

ALTER TABLE inspection_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_form_templates_admin_all" ON inspection_form_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- N12: shopping_list_templates
CREATE TABLE IF NOT EXISTS shopping_list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type TEXT NOT NULL,
  phase TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_template_id UUID REFERENCES shopping_list_templates(id),
  is_variation BOOLEAN DEFAULT false,
  variation_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  change_log JSONB DEFAULT '[]',
  promoted_from_instance_id UUID,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_templates_project_phase ON shopping_list_templates(project_type, phase);
CREATE INDEX IF NOT EXISTS idx_shopping_list_templates_active ON shopping_list_templates(is_active);

ALTER TABLE shopping_list_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_list_templates_admin_all" ON shopping_list_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- N13: template_promotions — universal promotion log
CREATE TABLE IF NOT EXISTS template_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_type TEXT NOT NULL,
  instance_id UUID NOT NULL,
  instance_table TEXT NOT NULL,
  source_template_id UUID,
  result_template_id UUID NOT NULL,
  promotion_type TEXT NOT NULL CHECK (promotion_type IN ('update_existing', 'create_variation')),
  variation_name TEXT,
  changes_promoted JSONB NOT NULL DEFAULT '[]',
  promoted_by UUID REFERENCES profiles(id),
  ai_suggested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_promotions_deliverable ON template_promotions(deliverable_type);
CREATE INDEX IF NOT EXISTS idx_template_promotions_instance ON template_promotions(instance_id);
CREATE INDEX IF NOT EXISTS idx_template_promotions_result_template ON template_promotions(result_template_id);

ALTER TABLE template_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_promotions_admin_all" ON template_promotions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
