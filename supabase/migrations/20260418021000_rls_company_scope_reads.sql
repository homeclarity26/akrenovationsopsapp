-- Fix read-path multi-tenant leaks.
--
-- can_access_project() was returning true for any admin regardless of company.
-- companies/profiles SELECT policies gated on is_admin() without company_id.
-- Surfaced by multi-tenant-rls.integration.test.ts.

-- 1. Tighten can_access_project to enforce company match for admin role.
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_project_company_id UUID;
BEGIN
  SELECT role, company_id INTO v_role, v_company_id FROM profiles WHERE id = auth.uid();
  IF v_role = 'super_admin' THEN
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

-- 2. companies SELECT: admin only reads own company; super_admin reads all.
DROP POLICY IF EXISTS "super_admin can read all companies" ON public.companies;
DROP POLICY IF EXISTS "Users can read own company" ON public.companies;
CREATE POLICY "Super admin reads all companies" ON public.companies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Users read own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = my_company_id());

-- 3. profiles SELECT: own row, or admin of same company, or super_admin.
DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles me WHERE me.id = auth.uid() AND me.role = 'super_admin')
    OR (is_admin() AND company_id = my_company_id())
  );

-- 4. profiles UPDATE: own row, or admin of same company, or super_admin.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles me WHERE me.id = auth.uid() AND me.role = 'super_admin')
    OR (is_admin() AND company_id = my_company_id())
  );

-- 5. profiles DELETE: admin of same company only (super_admin implicit).
DROP POLICY IF EXISTS "Admin deletes profile" ON public.profiles;
CREATE POLICY "Admin deletes profile" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles me WHERE me.id = auth.uid() AND me.role = 'super_admin')
    OR (is_admin() AND company_id = my_company_id())
  );

NOTIFY pgrst, 'reload schema';
