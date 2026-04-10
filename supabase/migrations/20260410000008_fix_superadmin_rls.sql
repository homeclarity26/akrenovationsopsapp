-- ============================================================================
-- Fix super_admin RLS — prevent infinite recursion + update helper functions
-- ============================================================================
-- Problem: The "super_admin can read all profiles" policy queries the
-- profiles table inside its own USING clause, causing potential infinite
-- recursion. Also, is_admin() only checks for role='admin', excluding
-- super_admin from many RLS policies across the app.
-- ============================================================================

-- 1. Update is_admin() to include super_admin
--    This is SECURITY DEFINER so it bypasses RLS (no recursion risk).
--    This single change propagates super_admin access to ALL tables that
--    use is_admin() in their RLS policies.
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
  RETURN COALESCE(v_role IN ('admin', 'super_admin'), false);
END;
$$;

-- 2. Update is_employee_or_admin() to also include super_admin
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
  RETURN COALESCE(v_role IN ('admin', 'employee', 'super_admin'), false);
END;
$$;

-- 3. Drop the self-referencing super_admin profiles policy (causes recursion)
--    With is_admin() now returning true for super_admin, the existing
--    "Users see own profile" policy (id = auth.uid() OR is_admin())
--    already grants super_admin full read access to all profiles.
DROP POLICY IF EXISTS "super_admin can read all profiles" ON profiles;

-- 4. Also fix the super_admin companies policy to use is_admin() instead
--    of a self-referencing subquery on profiles.
DROP POLICY IF EXISTS "super_admin can read all companies" ON companies;
CREATE POLICY "super_admin can read all companies"
  ON companies FOR SELECT
  USING (is_admin());

-- 5. Fix platform_settings and platform_audit_log policies similarly
DROP POLICY IF EXISTS "super_admin full access to platform_settings" ON platform_settings;
CREATE POLICY "super_admin full access to platform_settings"
  ON platform_settings FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "super_admin full access to platform_audit_log" ON platform_audit_log;
CREATE POLICY "super_admin full access to platform_audit_log"
  ON platform_audit_log FOR ALL
  USING (is_admin());
