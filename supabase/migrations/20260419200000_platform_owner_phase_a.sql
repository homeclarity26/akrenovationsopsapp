-- Platform-owner / company-admin separation — Phase A (non-destructive prep).
--
-- Adds the `platform_owner` role and an is_platform_owner() helper. Policies
-- that currently reference super_admin are UNCHANGED in this migration — the
-- cutover happens in Phase B.
--
-- After Phase A lands:
--   * role CHECK accepts {admin, employee, client, super_admin, platform_owner}
--   * A new platform_owner user can be seeded.
--   * is_platform_owner() returns true only for role='platform_owner'.
--
-- Adam's akrenovations01@gmail.com is still super_admin after Phase A. No
-- data access changes for any user until Phase B.

-- 1. Widen the role CHECK to include 'platform_owner' alongside existing roles.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employee', 'client', 'super_admin', 'platform_owner'));

-- 2. is_platform_owner() — true iff the authenticated user has role='platform_owner'.
CREATE OR REPLACE FUNCTION public.is_platform_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT role FROM profiles WHERE id = auth.uid()) = 'platform_owner', false);
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_platform_owner() IS
  'True for users managing the multi-tenant platform (the product owner persona), distinct from a company admin. Gates /platform routes and platform-level tables (companies, platform_settings, platform_audit_log).';
