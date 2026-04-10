-- ============================================================================
-- Fix Employee RLS Write Permissions (Issue H-01)
-- ============================================================================
-- The M21 base RLS migration grants employees SELECT on project-related
-- tables but restricts INSERT/UPDATE/DELETE to admins only. Employees need
-- to create and update records in several tables as part of their daily work.
--
-- This migration adds INSERT and UPDATE policies for employees on the
-- tables they need to write to. Uses the existing is_employee_or_admin()
-- helper function (created in M21).
--
-- NOTE: time_entries already has proper employee INSERT/UPDATE policies
-- from migration F6 (20260407000065_f6_rls_new_tables.sql). Skipped here.
-- ============================================================================

-- ── daily_logs: employees create daily work logs ───────────────────────────

DROP POLICY IF EXISTS "Employees insert daily_logs" ON daily_logs;
CREATE POLICY "Employees insert daily_logs" ON daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin() AND employee_id = auth.uid());

DROP POLICY IF EXISTS "Employees update own daily_logs" ON daily_logs;
CREATE POLICY "Employees update own daily_logs" ON daily_logs
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin() AND employee_id = auth.uid());

-- ── shopping_list_items: employees add items to shopping lists ─────────────

DROP POLICY IF EXISTS "Employees insert shopping_list_items" ON shopping_list_items;
CREATE POLICY "Employees insert shopping_list_items" ON shopping_list_items
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

DROP POLICY IF EXISTS "Employees update shopping_list_items" ON shopping_list_items;
CREATE POLICY "Employees update shopping_list_items" ON shopping_list_items
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin());

-- ── project_photos: employees upload job site photos ──────────────────────

DROP POLICY IF EXISTS "Employees insert project_photos" ON project_photos;
CREATE POLICY "Employees insert project_photos" ON project_photos
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

DROP POLICY IF EXISTS "Employees update own project_photos" ON project_photos;
CREATE POLICY "Employees update own project_photos" ON project_photos
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin() AND uploaded_by = auth.uid());

-- ── messages: employees send messages ─────────────────────────────────────

DROP POLICY IF EXISTS "Employees insert messages" ON messages;
CREATE POLICY "Employees insert messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin() AND sender_id = auth.uid());

-- ── tasks: employees update task status (UPDATE only, not INSERT) ─────────

DROP POLICY IF EXISTS "Employees update assigned tasks" ON tasks;
CREATE POLICY "Employees update assigned tasks" ON tasks
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin() AND assigned_to = auth.uid());

-- ── punch_list_items: employees flag punch list items ─────────────────────

DROP POLICY IF EXISTS "Employees insert punch_list_items" ON punch_list_items;
CREATE POLICY "Employees insert punch_list_items" ON punch_list_items
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin());

DROP POLICY IF EXISTS "Employees update punch_list_items" ON punch_list_items;
CREATE POLICY "Employees update punch_list_items" ON punch_list_items
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin());

-- ── expenses: employees submit expenses ───────────────────────────────────
-- NOTE: expenses is in the admin-only group in M21. Employees need to submit
-- expenses, so we add INSERT (scoped to own records) and UPDATE (own records).

DROP POLICY IF EXISTS "Employees insert expenses" ON expenses;
CREATE POLICY "Employees insert expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (is_employee_or_admin() AND entered_by = auth.uid());

DROP POLICY IF EXISTS "Employees update own expenses" ON expenses;
CREATE POLICY "Employees update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (is_employee_or_admin() AND entered_by = auth.uid());

-- Employees also need to read expenses they submitted
DROP POLICY IF EXISTS "Employees read own expenses" ON expenses;
CREATE POLICY "Employees read own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (is_admin() OR (is_employee_or_admin() AND entered_by = auth.uid()));
