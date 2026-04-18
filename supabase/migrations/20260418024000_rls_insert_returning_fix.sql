-- Fix: INSERT ... RETURNING fails with 42501 for admin users because the
-- SELECT policy calls can_access_project() (SECURITY DEFINER), and that
-- function's internal `SELECT company_id FROM projects WHERE id = p_project_id`
-- doesn't see the newly-inserted row during PostgREST's RETURNING evaluation.
--
-- Surfaced by concurrent-writes integration test 2026-04-18. Affects any
-- UI code path that does `.insert({...}).select()` against projects —
-- e.g. OnboardingPage client wizard.
--
-- Fix: inline the admin branch directly in the SELECT policy so it doesn't
-- go through the function. Employee/client branch can still use the helper.

DROP POLICY IF EXISTS "Assigned read projects" ON public.projects;
CREATE POLICY "Assigned read projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND company_id = my_company_id())
    OR is_assigned_to_project(id)
  );

NOTIFY pgrst, 'reload schema';
