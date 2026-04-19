-- Platform-owner / company-admin separation — Phase C (cleanup).
--
-- After Phase B landed successfully and the webkit sweep reports 52/52
-- under the two-login configuration, this migration completes the role
-- split:
--   * Drops 'super_admin' from the profiles_role_check CHECK so no new
--     row can ever have that role.
--   * Drops is_super_admin() entirely — it was repurposed as a compat
--     shim in Phase B and no live policy or live code still calls it.
--
-- Preconditions (enforced by DO blocks below — migration aborts if any
-- fail):
--   * Zero profiles with role='super_admin'.
--   * Zero policies anywhere referencing super_admin or calling
--     is_super_admin().

BEGIN;

-- Safety: no profiles still hold the retiring role.
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n FROM profiles WHERE role = 'super_admin';
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase C aborted: % profiles still on role=super_admin. Run Phase B first.', n;
  END IF;
END $$;

-- Safety: no policy still inlines the super_admin literal.
DO $$
DECLARE
  n INT;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
    AND (
      coalesce(qual, '')       ILIKE '%super_admin%'
      OR coalesce(with_check, '') ILIKE '%super_admin%'
      OR coalesce(policyname, '') ILIKE '%super_admin%'
    );
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase C aborted: % policies still reference super_admin. Run Phase B first.', n;
  END IF;
END $$;

-- Tighten the role CHECK — only 4 roles remain.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employee', 'client', 'platform_owner'));

-- Drop the compat shim. Any remaining function call is caught at apply
-- time by pg (pg will complain about the dependent function).
DROP FUNCTION IF EXISTS public.is_super_admin();

COMMIT;
