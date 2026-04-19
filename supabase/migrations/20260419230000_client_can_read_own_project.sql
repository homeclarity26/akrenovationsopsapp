-- Client-portal RLS fix — clients can read their own project.
--
-- Discovered during the 2026-04-19 deep E2E run: the projects SELECT policy
-- only granted access to platform_owner, admin-same-company, and employees
-- in project_assignments. Clients are linked to a project via
-- projects.client_user_id, which no policy referenced, so the client
-- portal would have returned 0 projects for any real client.
--
-- Fixes:
--   1. Extend the projects SELECT policy to include
--      client_user_id = auth.uid().
--   2. Extend can_access_project() to include the same check, so
--      downstream tables (project_phases, daily_logs, messages) that
--      gate reads by can_access_project() also work for clients.
--
-- No other policy needed rewriting — the audit_state.md claim that
-- "ClientProgress mirrors the same balance data via ProjectBalanceCard"
-- was actually based on admin-side testing, not a real client session.

BEGIN;

-- 1. Widen projects SELECT to include client-linked rows.
DROP POLICY IF EXISTS "Assigned read projects" ON public.projects;
CREATE POLICY "Assigned read projects"
  ON public.projects FOR SELECT
  USING (
    is_platform_owner()
    OR (is_admin() AND company_id = my_company_id())
    OR is_assigned_to_project(id)
    OR client_user_id = auth.uid()
  );

-- 2. Update can_access_project() to allow clients of the project.
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
  v_project_client_user_id UUID;
BEGIN
  SELECT role, company_id INTO v_role, v_company_id FROM profiles WHERE id = auth.uid();
  -- Platform owner: blanket cross-tenant (for future impersonation flow).
  IF v_role = 'platform_owner' THEN
    RETURN TRUE;
  END IF;
  SELECT company_id, client_user_id INTO v_project_company_id, v_project_client_user_id
  FROM projects WHERE id = p_project_id;
  -- Admin: same company as the project.
  IF v_role = 'admin' AND v_company_id = v_project_company_id THEN
    RETURN TRUE;
  END IF;
  -- Client: the project is linked to them via client_user_id.
  IF v_role = 'client' AND v_project_client_user_id = auth.uid() THEN
    RETURN TRUE;
  END IF;
  -- Employee: assigned to the project.
  RETURN is_assigned_to_project(p_project_id);
END;
$$;

COMMIT;
