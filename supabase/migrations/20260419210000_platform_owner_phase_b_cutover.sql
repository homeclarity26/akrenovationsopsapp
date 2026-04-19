-- Platform-owner / company-admin separation — Phase B (atomic cutover).
--
-- This migration is the single reviewable point where:
--   1. All 25 RLS policies that inlined `role = 'super_admin'` checks or
--      `is_super_admin()` get rewritten to gate by `is_platform_owner()`
--      (platform-level) or `is_admin()` (tenant admin), never both
--      implicitly.
--   2. Two pre-existing security bugs in policies on `platform_audit_log`
--      and `platform_settings` are fixed — they currently use USING=is_admin(),
--      meaning ANY company admin can see platform-level rows across tenants.
--      Rewritten to is_platform_owner().
--   3. `is_admin()` is tightened to return true ONLY for role='admin' (not
--      for 'super_admin' anymore). super_admin is going away in Phase C.
--   4. `can_access_project()` is updated to use is_platform_owner() in
--      place of its hardcoded 'super_admin' branch.
--   5. akrenovations01@gmail.com is downgraded from super_admin to admin
--      (scoped to AK Renovations via existing company_id=1e62cd50…).
--
-- Everything runs in one transaction so either the whole cutover lands or
-- nothing does. After it lands:
--   * adam@hometownbuildersclub.com (platform_owner) manages the multi-
--     tenant platform at /platform/*.
--   * akrenovations01@gmail.com (admin) manages AK Renovations at
--     /admin/* and can toggle to Field mode.
--   * No user is super_admin anymore. The role literal still exists in
--     the CHECK constraint until Phase C removes it (safety buffer in
--     case anything still writes 'super_admin').
--
-- Known follow-ups NOT addressed here (punted):
--   * ai_actions, subcontractors, templates have no company_id column,
--     so they're gated by is_admin() OR is_platform_owner() with no
--     tenant scoping. That's a pre-existing multi-tenant leak that only
--     matters when a second company signs up. Flagged for follow-up.
--   * Storage buckets use inline role=ANY('admin','super_admin') checks;
--     rewritten here to use is_admin() which matches the current behavior
--     (company admins get access). platform_owner has no blanket storage
--     access — appropriate since they shouldn't see customer receipts.

BEGIN;

-- ── 1. Tighten is_admin(): drop 'super_admin' from the role set ─────────
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role = 'admin', false);
END;
$$;

-- ── 2. Update can_access_project() to use is_platform_owner() ───────────
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_project_company_id UUID;
BEGIN
  SELECT role, company_id INTO v_role, v_company_id FROM profiles WHERE id = auth.uid();
  -- Platform owner sees everything (cross-tenant investigation)
  IF v_role = 'platform_owner' THEN
    RETURN TRUE;
  END IF;
  SELECT company_id INTO v_project_company_id FROM projects WHERE id = p_project_id;
  -- Admin: same company as the project
  IF v_role = 'admin' AND v_company_id = v_project_company_id THEN
    RETURN TRUE;
  END IF;
  -- Employee/client: assigned to the project (helper already exists)
  RETURN is_assigned_to_project(p_project_id);
END;
$$;

-- ── 3. Rewrite is_super_admin() as a thin compat shim ───────────────────
-- While Phase C is pending and the 'super_admin' role literal still
-- exists in the CHECK constraint, is_super_admin() returns true for
-- platform_owner so any legacy reference (in edge-function code or a
-- policy we missed) continues to grant platform-level access. After
-- Phase C this function is dropped.
CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT is_platform_owner();
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'DEPRECATED. Compat shim returning is_platform_owner(). Removed in Phase C.';

-- ── 4. Rewrite the 25 policies — one-at-a-time, explicit ────────────────

-- 4a. public.agent_execution_log — platform owner OR tenant admin
DROP POLICY IF EXISTS "Admin reads agent_execution_log" ON public.agent_execution_log;
CREATE POLICY "Admin reads agent_execution_log"
  ON public.agent_execution_log FOR SELECT
  USING (is_platform_owner() OR (is_admin() AND (company_id = my_company_id())));

-- 4b. public.ai_actions — tenant admin OR platform owner (no company_id col)
DROP POLICY IF EXISTS "Super admin only ai_actions" ON public.ai_actions;
CREATE POLICY "Admin and platform owner access ai_actions"
  ON public.ai_actions FOR ALL
  USING (is_admin() OR is_platform_owner())
  WITH CHECK (is_admin() OR is_platform_owner());

-- 4c. public.ai_conversations — platform_owner cross-tenant OR self OR tenant admin scoped to a project
DROP POLICY IF EXISTS "Admin full access ai_conversations" ON public.ai_conversations;
CREATE POLICY "Admin full access ai_conversations"
  ON public.ai_conversations FOR ALL
  USING (is_platform_owner() OR (user_id = auth.uid()) OR (is_admin() AND ((project_id IS NULL) OR admin_can_project(project_id))))
  WITH CHECK (is_platform_owner() OR (user_id = auth.uid()) OR (is_admin() AND ((project_id IS NULL) OR admin_can_project(project_id))));

-- 4d. public.companies — platform_owner sees all (cross-tenant list)
DROP POLICY IF EXISTS "Super admin reads all companies" ON public.companies;
CREATE POLICY "Platform owner reads all companies"
  ON public.companies FOR SELECT
  USING (is_platform_owner());

-- 4e. public.error_log — same pattern as agent_execution_log
DROP POLICY IF EXISTS "Admin reads error_log" ON public.error_log;
CREATE POLICY "Admin reads error_log"
  ON public.error_log FOR SELECT
  USING (is_platform_owner() OR (is_admin() AND (company_id = my_company_id())));

-- 4f. public.integrations (5 policies) — tenant admin scoped by company_id.
-- platform_owner does NOT get access to customer Stripe/QBO tokens; that
-- would be a security regression.
DROP POLICY IF EXISTS "integrations_admin_delete" ON public.integrations;
CREATE POLICY "integrations_admin_delete"
  ON public.integrations FOR DELETE
  USING (is_admin() AND company_id = my_company_id());

DROP POLICY IF EXISTS "integrations_admin_insert" ON public.integrations;
CREATE POLICY "integrations_admin_insert"
  ON public.integrations FOR INSERT
  WITH CHECK (is_admin() AND company_id = my_company_id());

DROP POLICY IF EXISTS "integrations_admin_read" ON public.integrations;
CREATE POLICY "integrations_admin_read"
  ON public.integrations FOR SELECT
  USING (is_admin() AND company_id = my_company_id());

DROP POLICY IF EXISTS "integrations_admin_select" ON public.integrations;
CREATE POLICY "integrations_admin_select"
  ON public.integrations FOR SELECT
  USING (is_admin() AND company_id = my_company_id());

DROP POLICY IF EXISTS "integrations_admin_update" ON public.integrations;
CREATE POLICY "integrations_admin_update"
  ON public.integrations FOR UPDATE
  USING (is_admin() AND company_id = my_company_id());

-- 4g. public.platform_audit_log — FIX security bug.
-- Previously USING=is_admin() meant any company admin could read
-- platform-wide audit entries. Rewrite to platform_owner only.
DROP POLICY IF EXISTS "super_admin full access to platform_audit_log" ON public.platform_audit_log;
CREATE POLICY "platform_owner full access to platform_audit_log"
  ON public.platform_audit_log FOR ALL
  USING (is_platform_owner())
  WITH CHECK (is_platform_owner());

-- 4h. public.platform_settings — same fix
DROP POLICY IF EXISTS "super_admin full access to platform_settings" ON public.platform_settings;
CREATE POLICY "platform_owner full access to platform_settings"
  ON public.platform_settings FOR ALL
  USING (is_platform_owner())
  WITH CHECK (is_platform_owner());

-- 4i. public.profiles (4 policies) — self OR platform_owner OR tenant admin same company
DROP POLICY IF EXISTS "Admin deletes profile" ON public.profiles;
CREATE POLICY "Admin deletes profile"
  ON public.profiles FOR DELETE
  USING (is_platform_owner() OR (is_admin() AND (company_id = my_company_id())));

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((id = auth.uid()) OR is_platform_owner() OR (is_admin() AND (company_id = my_company_id())));

DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile"
  ON public.profiles FOR SELECT
  USING ((id = auth.uid()) OR is_platform_owner() OR (is_admin() AND (company_id = my_company_id())));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING ((id = auth.uid()) OR is_platform_owner() OR (is_admin() AND (company_id = my_company_id())));

-- 4j. public.projects — Assigned read
DROP POLICY IF EXISTS "Assigned read projects" ON public.projects;
CREATE POLICY "Assigned read projects"
  ON public.projects FOR SELECT
  USING (is_platform_owner() OR (is_admin() AND (company_id = my_company_id())) OR is_assigned_to_project(id));

-- 4k. public.reminders — self OR tenant admin scoped by company_id
DROP POLICY IF EXISTS "Reminders self read" ON public.reminders;
CREATE POLICY "Reminders self read"
  ON public.reminders FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (is_admin() AND company_id = my_company_id())
    OR is_platform_owner()
  );

-- 4l. public.subcontractors — tenant admin OR platform owner (no company_id column)
DROP POLICY IF EXISTS "Super admin only subcontractors" ON public.subcontractors;
CREATE POLICY "Admin and platform owner access subcontractors"
  ON public.subcontractors FOR ALL
  USING (is_admin() OR is_platform_owner())
  WITH CHECK (is_admin() OR is_platform_owner());

-- 4m. public.templates — tenant admin OR platform owner (no company_id column)
DROP POLICY IF EXISTS "Super admin only templates" ON public.templates;
CREATE POLICY "Admin and platform owner access templates"
  ON public.templates FOR ALL
  USING (is_admin() OR is_platform_owner())
  WITH CHECK (is_admin() OR is_platform_owner());

-- 4n. public.time_entries — users update own open entries OR tenant admin
DROP POLICY IF EXISTS "Users update own open entries or admin updates any" ON public.time_entries;
CREATE POLICY "Users update own open entries or admin updates any"
  ON public.time_entries FOR UPDATE
  USING (
    ((user_id = auth.uid()) AND (clock_out IS NULL))
    OR is_admin()
    OR is_platform_owner()
  )
  WITH CHECK (
    (user_id = auth.uid())
    OR is_admin()
    OR is_platform_owner()
  );

-- 4o. storage.objects (4 policies) — rewrite role-array inline to is_admin()
DROP POLICY IF EXISTS "company_assets_admin_delete" ON storage.objects;
CREATE POLICY "company_assets_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-assets'
    AND auth.role() = 'authenticated'
    AND is_admin()
  );

DROP POLICY IF EXISTS "company_assets_admin_insert" ON storage.objects;
CREATE POLICY "company_assets_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-assets'
    AND auth.role() = 'authenticated'
    AND is_admin()
  );

DROP POLICY IF EXISTS "receipts_admin_delete" ON storage.objects;
CREATE POLICY "receipts_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND is_admin()
  );

DROP POLICY IF EXISTS "receipts_owner_read" ON storage.objects;
CREATE POLICY "receipts_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR is_admin()
    )
  );

-- ── 5. Downgrade the existing super_admin account ───────────────────────
-- akrenovations01@gmail.com already has company_id set to AK Renovations,
-- so downgrading to 'admin' lands him cleanly inside his own tenant.
UPDATE profiles
SET role = 'admin'
WHERE email = 'akrenovations01@gmail.com'
  AND role = 'super_admin';

-- Sanity: zero users should still be super_admin after this.
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n FROM profiles WHERE role = 'super_admin';
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase B cutover left % profiles still on role=super_admin', n;
  END IF;
END $$;

COMMIT;
