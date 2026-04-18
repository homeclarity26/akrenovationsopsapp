-- ============================================================================
-- Add projects.company_id
-- ============================================================================
-- The app UI (src/pages/admin/ProjectsPage.tsx), several RLS policies, and
-- the validate_shopping_inventory_scope() trigger defined in
-- 20260415001000_wave_a_integrity_fixes.sql all assume a `company_id`
-- column on the `projects` table. No prior migration actually adds it,
-- so "Create Project" in the UI fails with PostgreSQL error 42703:
-- "column projects.company_id does not exist".
--
-- Verified live on 2026-04-18 via a direct PostgREST query:
--   GET /rest/v1/projects?select=company_id&limit=1
--   → 400 { "code": "42703", "message": "column projects.company_id does not exist" }
--
-- Idempotent. Safe to run multiple times.
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS projects_company_id_idx
  ON projects(company_id);

-- Reload PostgREST's schema cache so the REST API picks up the new column
-- without a full restart.
NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Backfill strategy — NOT included on purpose.
-- ────────────────────────────────────────────────────────────────────────────
-- The live DB had zero project rows as of 2026-04-18. Once crews start using
-- the app, company_id will be populated on insert by the UI. If you later
-- discover orphan rows with NULL company_id, fill them manually via a
-- targeted UPDATE — this migration stays minimal and reversible.
--
-- To tighten later (recommended after the first week of real use):
--   ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
-- ────────────────────────────────────────────────────────────────────────────
