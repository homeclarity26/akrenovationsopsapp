-- ============================================================================
-- Project Assignments + RLS Scoping (PR 1 of Live Shared Project State)
-- ============================================================================
-- Goal: employees only see/edit projects they are explicitly assigned to.
-- Admins and super_admins retain full access.
--
-- The base schema (20260407000000_aa_base_schema.sql) already created
-- project_assignments(id, project_id, employee_id, role, assigned_at).
-- This migration EXTENDS that table rather than recreating it:
--   - adds `active`, `assigned_by`, `updated_at`
--   - widens the role enum to include foreman/worker/observer alongside 'crew'
--   - enforces UNIQUE(project_id, employee_id)
--   - adds indexes for lookup hot paths
--
-- Then it swaps the M21 "any employee can read" policies on project-scoped
-- tables for "assigned employee or admin" policies, using a new
-- SECURITY DEFINER helper `can_access_project(uuid)`.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend project_assignments
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id);

ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Widen the role CHECK: keep legacy 'crew' so existing rows don't fail,
-- add the 3-tier model the admin Team tab will use.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_assignments_role_check'
  ) THEN
    ALTER TABLE project_assignments DROP CONSTRAINT project_assignments_role_check;
  END IF;
END $$;

ALTER TABLE project_assignments
  ADD CONSTRAINT project_assignments_role_check
  CHECK (role IN ('foreman', 'worker', 'observer', 'crew'));

-- Only one active-or-historical row per (project, employee). If someone is
-- removed and re-added, flip `active` rather than creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS project_assignments_project_employee_uniq
  ON project_assignments(project_id, employee_id);

CREATE INDEX IF NOT EXISTS project_assignments_employee_active_idx
  ON project_assignments(employee_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS project_assignments_project_active_idx
  ON project_assignments(project_id) WHERE active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: is_assigned_to_project / can_access_project
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors the is_admin() / is_employee_or_admin() pattern from M21:
-- SECURITY DEFINER so the lookup bypasses RLS on project_assignments itself
-- (which would otherwise recurse).

CREATE OR REPLACE FUNCTION is_assigned_to_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_assignments
    WHERE project_id = p_project_id
      AND employee_id = auth.uid()
      AND active = true
  );
END;
$$;

-- Convenience wrapper: admin OR assigned employee.
-- Use this in RLS USING clauses on every project-scoped table.
CREATE OR REPLACE FUNCTION can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN is_admin() OR is_assigned_to_project(p_project_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS on project_assignments itself
-- ─────────────────────────────────────────────────────────────────────────────
-- M21 enabled RLS on this table and added the blanket "Employees and admin read"
-- policy. Replace that with a tighter rule: admins see everything; employees
-- see their own assignment rows + rows for projects they're on (so they can
-- see teammates in the team tab).

ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees and admin read" ON project_assignments;
DROP POLICY IF EXISTS "Admin writes" ON project_assignments;
DROP POLICY IF EXISTS "Admin updates" ON project_assignments;
DROP POLICY IF EXISTS "Admin deletes" ON project_assignments;

CREATE POLICY "Assignment read" ON project_assignments
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR employee_id = auth.uid()
    OR is_assigned_to_project(project_id)
  );

CREATE POLICY "Admin manages assignments" ON project_assignments
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tighten SELECT on project-scoped tables
-- ─────────────────────────────────────────────────────────────────────────────
-- M21 granted every employee SELECT on each of these via is_employee_or_admin().
-- Replace that with can_access_project(<row's project_id>).
--
-- `projects` is special — the project_id *is* `id`.

DROP POLICY IF EXISTS "Employees and admin read" ON projects;
CREATE POLICY "Assigned read projects" ON projects
  FOR SELECT TO authenticated
  USING (can_access_project(id));

DO $$
DECLARE
  t TEXT;
  scoped_tables TEXT[] := ARRAY[
    'project_phases',
    'daily_logs',
    'tasks',
    'project_photos',
    'project_files',
    'schedule_events',
    'shopping_list_items',
    'punch_list_items',
    'warranty_claims',
    'messages'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Employees and admin read" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "Assigned read" ON %I FOR SELECT TO authenticated USING (can_access_project(%I.project_id))',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Tighten employee INSERT/UPDATE on project-scoped tables
-- ─────────────────────────────────────────────────────────────────────────────
-- The employee write policies from 20260409000002 only required
-- is_employee_or_admin(). Now also require the employee to be assigned to the
-- target project. Admins still pass via is_admin() short-circuit in
-- can_access_project().

-- daily_logs
DROP POLICY IF EXISTS "Employees insert daily_logs" ON daily_logs;
CREATE POLICY "Employees insert daily_logs" ON daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin()
    AND employee_id = auth.uid()
    AND can_access_project(project_id)
  );

DROP POLICY IF EXISTS "Employees update own daily_logs" ON daily_logs;
CREATE POLICY "Employees update own daily_logs" ON daily_logs
  FOR UPDATE TO authenticated
  USING (
    is_employee_or_admin()
    AND employee_id = auth.uid()
    AND can_access_project(project_id)
  );

-- shopping_list_items
DROP POLICY IF EXISTS "Employees insert shopping_list_items" ON shopping_list_items;
CREATE POLICY "Employees insert shopping_list_items" ON shopping_list_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin() AND can_access_project(project_id)
  );

DROP POLICY IF EXISTS "Employees update shopping_list_items" ON shopping_list_items;
CREATE POLICY "Employees update shopping_list_items" ON shopping_list_items
  FOR UPDATE TO authenticated
  USING (
    is_employee_or_admin() AND can_access_project(project_id)
  );

-- project_photos
DROP POLICY IF EXISTS "Employees insert project_photos" ON project_photos;
CREATE POLICY "Employees insert project_photos" ON project_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin() AND can_access_project(project_id)
  );

DROP POLICY IF EXISTS "Employees update own project_photos" ON project_photos;
CREATE POLICY "Employees update own project_photos" ON project_photos
  FOR UPDATE TO authenticated
  USING (
    is_employee_or_admin()
    AND uploaded_by = auth.uid()
    AND can_access_project(project_id)
  );

-- messages
DROP POLICY IF EXISTS "Employees insert messages" ON messages;
CREATE POLICY "Employees insert messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin()
    AND sender_id = auth.uid()
    AND can_access_project(project_id)
  );

-- tasks (UPDATE only — existing policy didn't allow employee INSERT)
DROP POLICY IF EXISTS "Employees update assigned tasks" ON tasks;
CREATE POLICY "Employees update assigned tasks" ON tasks
  FOR UPDATE TO authenticated
  USING (
    is_employee_or_admin()
    AND assigned_to = auth.uid()
    AND can_access_project(project_id)
  );

-- punch_list_items
DROP POLICY IF EXISTS "Employees insert punch_list_items" ON punch_list_items;
CREATE POLICY "Employees insert punch_list_items" ON punch_list_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin() AND can_access_project(project_id)
  );

DROP POLICY IF EXISTS "Employees update punch_list_items" ON punch_list_items;
CREATE POLICY "Employees update punch_list_items" ON punch_list_items
  FOR UPDATE TO authenticated
  USING (
    is_employee_or_admin() AND can_access_project(project_id)
  );

-- expenses (employee reads own + must be assigned to project)
DROP POLICY IF EXISTS "Employees insert expenses" ON expenses;
CREATE POLICY "Employees insert expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin()
    AND entered_by = auth.uid()
    AND (project_id IS NULL OR can_access_project(project_id))
  );

DROP POLICY IF EXISTS "Employees update own expenses" ON expenses;
CREATE POLICY "Employees update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (
    is_employee_or_admin()
    AND entered_by = auth.uid()
    AND (project_id IS NULL OR can_access_project(project_id))
  );

DROP POLICY IF EXISTS "Employees read own expenses" ON expenses;
CREATE POLICY "Employees read own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (is_employee_or_admin() AND entered_by = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. updated_at trigger for project_assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION project_assignments_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_assignments_updated_at ON project_assignments;
CREATE TRIGGER trg_project_assignments_updated_at
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION project_assignments_set_updated_at();
