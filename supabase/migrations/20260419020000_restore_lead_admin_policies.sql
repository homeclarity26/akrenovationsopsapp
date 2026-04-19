-- Fix: admin INSERT/UPDATE/DELETE on leads (and related) was silently dropped
-- by 20260418020000_tighten_admin_rls_company_scope.sql.
--
-- That migration enumerated a list of project-scoped tables to rewrite — it
-- DROPped the old "Admin full access" policies for every table in the list,
-- but only recreated replacement policies for the subset that actually have
-- project_id columns. `leads`, `lead_activities`, and `referral_notifications`
-- have no project_id (and no company_id on `leads` either), so they never got
-- replacement policies. Result: authenticated admins got 403 on every INSERT
-- into leads, which broke the CRM "Add Lead" flow and the agent-referral-
-- intake edge function that depends on it.
--
-- Restore minimal, correct admin/super_admin access. Keep them permissive
-- rather than inventing a company_id scoping that the table doesn't support
-- today; when leads gets a company_id in a future migration, tighten then.

-- leads
DROP POLICY IF EXISTS "Admin manages leads" ON public.leads;
CREATE POLICY "Admin manages leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- lead_activities (scoped through the parent lead — admin if they can manage any lead)
DROP POLICY IF EXISTS "Admin manages lead_activities" ON public.lead_activities;
CREATE POLICY "Admin manages lead_activities" ON public.lead_activities
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- referral_notifications
DROP POLICY IF EXISTS "Admin manages referral_notifications" ON public.referral_notifications;
CREATE POLICY "Admin manages referral_notifications" ON public.referral_notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
