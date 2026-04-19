-- Fix: 11 tables were left with RLS enabled but zero policies by
-- 20260418020000_tighten_admin_rls_company_scope.sql — the DO block dropped
-- their unscoped "Admin full access" policies, but the CREATE POLICY section
-- below only enumerated the subset with project_id scoping. Everything else
-- lost all access for authenticated users (RLS enabled + no policy = default
-- deny). Affected tables:
--
--   bonus_records, client_progress_updates, contracts, estimates, permits,
--   project_assignments, project_reels, project_subcontractors, proposals,
--   purchase_orders, review_requests, satisfaction_surveys
--
-- Symptom: silent 403 on every INSERT/UPDATE/DELETE from admin, so Projects →
-- Proposals, Projects → Contracts, assigning employees, tracking bonuses,
-- logging permits etc. all appeared broken.
--
-- Fix pattern: for project-scoped tables, reuse admin_can_project(project_id).
-- For the one table without a project_id or other scope (`estimates`), use
-- a straight role check until the table grows a proper scope column.

-- Project-scoped tables
CREATE POLICY "Admin manages bonus_records" ON public.bonus_records
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages client_progress_updates" ON public.client_progress_updates
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages permits" ON public.permits
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages project_assignments" ON public.project_assignments
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

-- project_reels had a SELECT policy already; add the write branch.
DROP POLICY IF EXISTS "Admin manages project_reels" ON public.project_reels;
CREATE POLICY "Admin manages project_reels" ON public.project_reels
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages project_subcontractors" ON public.project_subcontractors
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages proposals" ON public.proposals
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages review_requests" ON public.review_requests
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages satisfaction_surveys" ON public.satisfaction_surveys
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

-- Unscoped table (no project_id / company_id yet)
CREATE POLICY "Admin manages estimates" ON public.estimates
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

NOTIFY pgrst, 'reload schema';
