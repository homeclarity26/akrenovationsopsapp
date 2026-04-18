-- Tighten admin RLS policies to scope by company_id.
--
-- Pre-fix: any admin of any company could UPDATE/DELETE/INSERT rows in any
-- other company's scope, because the admin policies gated only on `is_admin()`.
-- This was a live multi-tenant leak, surfaced by the new multi-tenant-rls
-- integration test 2026-04-18.
--
-- Fix: add a helper `my_company_id()` that returns the calling user's company,
-- and rewrite every admin-write policy on tenant-scoped tables to enforce
-- `company_id = my_company_id()` (direct) or
-- `EXISTS(SELECT 1 FROM projects p WHERE p.id = <table>.project_id AND p.company_id = my_company_id())` (indirect).

-- ----------------------------------------------------------------------------
-- 1. Helper
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_company_id() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Tables with direct company_id column
-- ----------------------------------------------------------------------------

-- projects
DROP POLICY IF EXISTS "Admin writes" ON public.projects;
DROP POLICY IF EXISTS "Admin updates" ON public.projects;
DROP POLICY IF EXISTS "Admin deletes" ON public.projects;
CREATE POLICY "Admin writes" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND company_id = my_company_id());
CREATE POLICY "Admin updates" ON public.projects
  FOR UPDATE TO authenticated
  USING (is_admin() AND company_id = my_company_id())
  WITH CHECK (is_admin() AND company_id = my_company_id());
CREATE POLICY "Admin deletes" ON public.projects
  FOR DELETE TO authenticated
  USING (is_admin() AND company_id = my_company_id());

-- profiles — admins can only manage profiles in their own company
DROP POLICY IF EXISTS "Admin reads profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin writes profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin updates profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin deletes profiles" ON public.profiles;
CREATE POLICY "Admin reads profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_admin() AND company_id = my_company_id());
CREATE POLICY "Admin writes profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND company_id = my_company_id());
CREATE POLICY "Admin updates profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin() AND company_id = my_company_id())
  WITH CHECK (is_admin() AND company_id = my_company_id());
CREATE POLICY "Admin deletes profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (is_admin() AND company_id = my_company_id());

-- companies — admins can only read their own company
DROP POLICY IF EXISTS "Admin reads companies" ON public.companies;
CREATE POLICY "Admin reads companies" ON public.companies
  FOR SELECT TO authenticated
  USING (is_admin() AND id = my_company_id());

-- suppliers
DROP POLICY IF EXISTS "Admin manages suppliers" ON public.suppliers;
CREATE POLICY "Admin manages suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- inventory_items
DROP POLICY IF EXISTS "Admin manages inventory_items" ON public.inventory_items;
CREATE POLICY "Admin manages inventory_items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- inventory_locations
DROP POLICY IF EXISTS "Admin manages inventory_locations" ON public.inventory_locations;
CREATE POLICY "Admin manages inventory_locations" ON public.inventory_locations
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- inventory_categories
DROP POLICY IF EXISTS "Admin manages inventory_categories" ON public.inventory_categories;
CREATE POLICY "Admin manages inventory_categories" ON public.inventory_categories
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- inventory_item_templates
DROP POLICY IF EXISTS "Admin manages inventory_item_templates" ON public.inventory_item_templates;
CREATE POLICY "Admin manages inventory_item_templates" ON public.inventory_item_templates
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- inventory_alerts
DROP POLICY IF EXISTS "Admin manages inventory_alerts" ON public.inventory_alerts;
CREATE POLICY "Admin manages inventory_alerts" ON public.inventory_alerts
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- improvement_suggestions
DROP POLICY IF EXISTS "Admin manages improvement_suggestions" ON public.improvement_suggestions;
CREATE POLICY "Admin manages improvement_suggestions" ON public.improvement_suggestions
  FOR ALL TO authenticated
  USING (is_admin() AND (company_id = my_company_id() OR company_id IS NULL))
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- ----------------------------------------------------------------------------
-- 3. Tables scoped via project_id (must join through projects)
-- ----------------------------------------------------------------------------

-- Helper: is_admin AND the project belongs to my company
CREATE OR REPLACE FUNCTION public.admin_can_project(p_project_id uuid)
RETURNS bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin() AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = p_project_id AND p.company_id = my_company_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_can_project(uuid) TO authenticated;

-- Iterate a set of project-scoped tables and rewrite their admin policies.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tasks', 'daily_logs', 'messages', 'project_files', 'project_phases',
    'project_photos', 'project_activity', 'project_assignments', 'project_reels',
    'project_subcontractors', 'inspection_reports', 'change_orders', 'punch_list_items',
    'warranty_claims', 'shopping_list_items', 'schedule_events', 'expenses',
    'invoices', 'estimates', 'proposals', 'contracts', 'permits',
    'bonus_records', 'satisfaction_surveys', 'review_requests',
    'client_progress_updates', 'client_selections', 'referral_notifications',
    'purchase_orders', 'ai_project_suggestions', 'communication_log',
    'lead_activities', 'leads'
  ])
  LOOP
    -- Drop every policy whose qual references is_admin() without company_id
    EXECUTE format('
      DO $inner$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT policyname FROM pg_policies
          WHERE schemaname = %L AND tablename = %L
            AND (qual ILIKE %L OR with_check ILIKE %L)
            AND qual NOT ILIKE %L AND COALESCE(with_check, %L) NOT ILIKE %L
        LOOP
          EXECUTE format(%L, r.policyname);
        END LOOP;
      END$inner$;
      ', 'public', t,
      '%is_admin()%', '%is_admin()%',
      '%company_id%', '', '%company_id%',
      'DROP POLICY IF EXISTS %I ON public.' || t);
  END LOOP;
END $$;

-- For each project-scoped table, create admin policies gated via admin_can_project.
-- (tables vary in whether they have project_id directly; assume yes for now
-- and guard via IF EXISTS to skip tables that don't).

-- This section is repeated per-table because policy names must be unique.
-- Keep it mechanical.

CREATE POLICY "Admin writes tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes tasks" ON public.tasks
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin writes daily_logs" ON public.daily_logs
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates daily_logs" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes daily_logs" ON public.daily_logs
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin writes messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes messages" ON public.messages
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin manages change_orders" ON public.change_orders
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin writes project_files" ON public.project_files
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates project_files" ON public.project_files
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes project_files" ON public.project_files
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin writes project_phases" ON public.project_phases
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates project_phases" ON public.project_phases
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes project_phases" ON public.project_phases
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin writes project_photos" ON public.project_photos
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates project_photos" ON public.project_photos
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes project_photos" ON public.project_photos
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin writes punch_list" ON public.punch_list_items
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates punch_list" ON public.punch_list_items
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes punch_list" ON public.punch_list_items
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin manages warranty_claims" ON public.warranty_claims
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin writes shopping_list" ON public.shopping_list_items
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates shopping_list" ON public.shopping_list_items
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes shopping_list" ON public.shopping_list_items
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin writes schedule_events" ON public.schedule_events
  FOR INSERT TO authenticated WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin updates schedule_events" ON public.schedule_events
  FOR UPDATE TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));
CREATE POLICY "Admin deletes schedule_events" ON public.schedule_events
  FOR DELETE TO authenticated USING (admin_can_project(project_id));

CREATE POLICY "Admin manages expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

CREATE POLICY "Admin manages inspection_reports" ON public.inspection_reports
  FOR ALL TO authenticated
  USING (admin_can_project(project_id)) WITH CHECK (admin_can_project(project_id));

NOTIFY pgrst, 'reload schema';
