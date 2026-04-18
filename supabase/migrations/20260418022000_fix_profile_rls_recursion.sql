-- Fix infinite recursion in profiles SELECT policy.
--
-- Prior migration used `EXISTS (SELECT 1 FROM profiles me WHERE ...)` inside
-- the profiles policy, which re-entered the same policy on the subquery
-- and triggered 42P17 infinite recursion.
--
-- Use a SECURITY DEFINER helper to bypass RLS on the self-lookup.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin', false);
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Rewrite profile policies to use the helper instead of an inline subquery.
DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR is_super_admin()
    OR (is_admin() AND company_id = my_company_id())
  );

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR is_super_admin()
    OR (is_admin() AND company_id = my_company_id())
  );

DROP POLICY IF EXISTS "Admin deletes profile" ON public.profiles;
CREATE POLICY "Admin deletes profile" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND company_id = my_company_id())
  );

-- Same pattern for the super_admin branch on companies.
DROP POLICY IF EXISTS "Super admin reads all companies" ON public.companies;
CREATE POLICY "Super admin reads all companies" ON public.companies
  FOR SELECT TO authenticated
  USING (is_super_admin());

NOTIFY pgrst, 'reload schema';
