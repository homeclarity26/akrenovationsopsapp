-- B1: Add budget_mode to projects
-- budget_mode: null (not applicable), 'standard' (basic), 'detailed' (full budget module)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_mode TEXT CHECK (budget_mode IN ('standard', 'detailed'));

-- RLS already exists on projects table - no changes needed
