-- K30: Add labor columns to estimate_line_items
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS labor_hours_min NUMERIC;
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS labor_hours_max NUMERIC;
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS labor_hours_typical NUMERIC;
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN (
  'apprentice', 'journeyman', 'master', 'sub_required'
));
