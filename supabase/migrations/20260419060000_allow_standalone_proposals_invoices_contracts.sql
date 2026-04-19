-- Fix: Proposals page "Start from scratch" flow was 403-ing on INSERT because
-- my earlier RLS restoration used admin_can_project(project_id) as the only
-- check, but proposals.project_id is nullable by schema and the UI lets
-- admins create a proposal without picking a project first.
-- admin_can_project(NULL) returns false, so the insert was always denied.
--
-- Same issue for contracts (project_id nullable, policy required it).
--
-- Invoices has project_id NOT NULL so the check was fine, but the policy
-- still rejects cases where admin wants to read/edit an invoice on a
-- project that belongs to another tenant — the existing policy already
-- handled that via admin_can_project. Keeping invoices on admin_can_project.
--
-- Fix: widen proposals and contracts policies so admins can always manage
-- rows that have no project_id (defaults to company-scoped admin role).
-- Still uses admin_can_project() when project_id is set, so the per-project
-- company check stays intact.

DROP POLICY IF EXISTS "Admin manages proposals" ON public.proposals;
CREATE POLICY "Admin manages proposals" ON public.proposals
  FOR ALL TO authenticated
  USING (
    is_admin() AND (project_id IS NULL OR admin_can_project(project_id))
  )
  WITH CHECK (
    is_admin() AND (project_id IS NULL OR admin_can_project(project_id))
  );

DROP POLICY IF EXISTS "Admin manages contracts" ON public.contracts;
CREATE POLICY "Admin manages contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (
    is_admin() AND (project_id IS NULL OR admin_can_project(project_id))
  )
  WITH CHECK (
    is_admin() AND (project_id IS NULL OR admin_can_project(project_id))
  );

NOTIFY pgrst, 'reload schema';
