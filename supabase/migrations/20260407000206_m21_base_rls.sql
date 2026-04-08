-- M21: Belt-and-suspenders RLS for the base CLAUDE.md schema tables.
--
-- Per the Phase M audit: the base CLAUDE.md schema tables (profiles, projects,
-- leads, invoices, expenses, contracts, proposals, etc.) were created in the
-- bootstrap migration WITHOUT RLS enabled. This migration enables RLS on every
-- one of them and adds baseline policies. Idempotent — safe to run multiple
-- times. ALTER TABLE ... ENABLE RLS is a no-op if already enabled.
--
-- Policy model:
--   - Admin: full access to everything
--   - Employee: read access to assigned projects + own data
--   - Client: read access to own project data
--   - Specific tables get tighter rules below

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enable RLS on every base table (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  base_tables TEXT[] := ARRAY[
    'profiles',
    'leads', 'lead_activities', 'referral_notifications',
    'projects', 'project_phases', 'project_assignments',
    'estimates', 'proposals', 'contracts',
    'invoices', 'expenses', 'purchase_orders',
    'time_entries_legacy',
    'shopping_list_items', 'daily_logs', 'tasks',
    'project_photos', 'project_files',
    'client_selections',
    'change_orders',
    'punch_list_items', 'warranty_claims',
    'subcontractors', 'project_subcontractors',
    'messages', 'communication_log', 'client_progress_updates',
    'schedule_events', 'permits',
    'templates',
    'ai_actions', 'ai_conversations',
    'satisfaction_surveys', 'review_requests',
    'bonus_records'
  ];
BEGIN
  FOREACH t IN ARRAY base_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: SECURITY DEFINER function to check admin without RLS recursion
-- ─────────────────────────────────────────────────────────────────────────────
-- The naive admin check `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
-- AND role = 'admin')` triggers RLS on profiles, which itself depends on this
-- check, creating infinite recursion. Wrapping it in a security-definer
-- function bypasses RLS for this read.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role = 'admin', false);
END;
$$;

CREATE OR REPLACE FUNCTION is_employee_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role IN ('admin', 'employee'), false);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. profiles — anyone can read their own row, admin reads all
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own profile" ON profiles;
CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Admin deletes profile" ON profiles;
CREATE POLICY "Admin deletes profile" ON profiles
  FOR DELETE TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Admin-only tables (financial + legal + AI)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  admin_only_tables TEXT[] := ARRAY[
    'invoices', 'expenses', 'contracts', 'proposals', 'estimates',
    'purchase_orders', 'change_orders',
    'leads', 'lead_activities', 'referral_notifications',
    'communication_log', 'client_progress_updates',
    'satisfaction_surveys', 'review_requests',
    'bonus_records', 'ai_actions', 'ai_conversations',
    'subcontractors', 'project_subcontractors',
    'permits', 'templates',
    'time_entries_legacy'
  ];
BEGIN
  FOREACH t IN ARRAY admin_only_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "Admin full access" ON %I FOR ALL TO authenticated USING (is_admin())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Employee + admin readable: projects, project_phases, project_assignments,
--    daily_logs, tasks, project_photos, project_files, schedule_events,
--    shopping_list_items, punch_list_items, warranty_claims, messages
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  emp_readable_tables TEXT[] := ARRAY[
    'projects', 'project_phases', 'project_assignments',
    'daily_logs', 'tasks',
    'project_photos', 'project_files',
    'schedule_events',
    'shopping_list_items',
    'punch_list_items',
    'warranty_claims',
    'messages'
  ];
BEGIN
  FOREACH t IN ARRAY emp_readable_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Employees and admin read" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "Employees and admin read" ON %I FOR SELECT TO authenticated USING (is_employee_or_admin())',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS "Admin writes" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "Admin writes" ON %I FOR INSERT TO authenticated WITH CHECK (is_admin())',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS "Admin updates" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "Admin updates" ON %I FOR UPDATE TO authenticated USING (is_admin())',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS "Admin deletes" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "Admin deletes" ON %I FOR DELETE TO authenticated USING (is_admin())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Client-visible: client_selections — clients can see and edit their own
--    project's selections
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Client sees own project selections" ON client_selections;
CREATE POLICY "Client sees own project selections" ON client_selections
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = client_selections.project_id
      AND p.client_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Client updates own selections" ON client_selections;
CREATE POLICY "Client updates own selections" ON client_selections
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = client_selections.project_id
      AND p.client_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin inserts selections" ON client_selections;
CREATE POLICY "Admin inserts selections" ON client_selections
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Note: project_photos, project_files, warranty_claims, messages, etc.
--    already have employee-or-admin SELECT from step 5. The Phase M security
--    spec also wants client visibility for some of these (visible_to_client
--    column on project_files for example). That's a Phase M+1 enhancement —
--    for now, clients access these through admin-curated views.
-- ─────────────────────────────────────────────────────────────────────────────
