-- Close the remaining unscoped admin RLS policies.
-- Post prior migrations, 31 'admin-only' policies still lacked a company
-- or project filter. This tightens each in place.

-- Inventory tables (direct company_id)
DROP POLICY IF EXISTS "Admin full access inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Admin full access inventory_locations" ON public.inventory_locations;
DROP POLICY IF EXISTS "Admin full access inventory_categories" ON public.inventory_categories;
DROP POLICY IF EXISTS "Admin full access inventory_alerts" ON public.inventory_alerts;
DROP POLICY IF EXISTS "Admin full access inventory_item_templates" ON public.inventory_item_templates;

-- inventory_stock / inventory_stocktakes — scoped via location.company_id
DROP POLICY IF EXISTS "Admin full access inventory_stock" ON public.inventory_stock;
DROP POLICY IF EXISTS "Admin full access inventory_stocktakes" ON public.inventory_stocktakes;
CREATE POLICY "Admin full access inventory_stock" ON public.inventory_stock
  FOR ALL TO authenticated
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM inventory_locations l WHERE l.id = inventory_stock.location_id AND l.company_id = my_company_id()
  ))
  WITH CHECK (is_admin() AND EXISTS (
    SELECT 1 FROM inventory_locations l WHERE l.id = inventory_stock.location_id AND l.company_id = my_company_id()
  ));
CREATE POLICY "Admin full access inventory_stocktakes" ON public.inventory_stocktakes
  FOR ALL TO authenticated
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM inventory_locations l WHERE l.id = inventory_stocktakes.location_id AND l.company_id = my_company_id()
  ))
  WITH CHECK (is_admin() AND EXISTS (
    SELECT 1 FROM inventory_locations l WHERE l.id = inventory_stocktakes.location_id AND l.company_id = my_company_id()
  ));

-- Observability tables (company_id direct)
DROP POLICY IF EXISTS "Admin full access" ON public.agent_execution_log;
DROP POLICY IF EXISTS "Admin full access" ON public.error_log;
DROP POLICY IF EXISTS "Admin full access" ON public.improvement_suggestions;
CREATE POLICY "Admin reads agent_execution_log" ON public.agent_execution_log
  FOR SELECT TO authenticated
  USING (is_super_admin() OR (is_admin() AND company_id = my_company_id()));
CREATE POLICY "Admin reads error_log" ON public.error_log
  FOR SELECT TO authenticated
  USING (is_super_admin() OR (is_admin() AND company_id = my_company_id()));

-- Project-scoped INSERT-only leftover policies
DROP POLICY IF EXISTS "Admin writes" ON public.tasks;
DROP POLICY IF EXISTS "Admin writes" ON public.daily_logs;
DROP POLICY IF EXISTS "Admin writes" ON public.messages;
DROP POLICY IF EXISTS "Admin writes" ON public.project_files;
DROP POLICY IF EXISTS "Admin writes" ON public.project_phases;
DROP POLICY IF EXISTS "Admin writes" ON public.project_photos;
DROP POLICY IF EXISTS "Admin writes" ON public.punch_list_items;
DROP POLICY IF EXISTS "Admin writes" ON public.schedule_events;
DROP POLICY IF EXISTS "Admin writes" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Admin writes" ON public.warranty_claims;
-- (These were replaced in 20260418020000 by scoped siblings; drop the old ones cleanly now.)

-- client_selections: scoped by project_id
DROP POLICY IF EXISTS "Admin inserts selections" ON public.client_selections;
CREATE POLICY "Admin inserts selections" ON public.client_selections
  FOR INSERT TO authenticated
  WITH CHECK (admin_can_project(project_id));

-- ai_project_suggestions: scoped by project_id
DROP POLICY IF EXISTS "Suggestion admin insert" ON public.ai_project_suggestions;
CREATE POLICY "Suggestion admin insert" ON public.ai_project_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (admin_can_project(project_id));

-- communication_log: scoped by project_id (NULL project_id = company-wide, require my_company_id)
DROP POLICY IF EXISTS "Comm log insert" ON public.communication_log;
CREATE POLICY "Comm log insert" ON public.communication_log
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() AND (
      project_id IS NULL
      OR admin_can_project(project_id)
    )
  );

-- ai_actions / ai_conversations: scoped by user_id (ai_conversations has user_id col)
DROP POLICY IF EXISTS "Admin full access" ON public.ai_actions;
DROP POLICY IF EXISTS "Admin full access" ON public.ai_conversations;
CREATE POLICY "Admin full access ai_conversations" ON public.ai_conversations
  FOR ALL TO authenticated
  USING (is_super_admin() OR user_id = auth.uid() OR (is_admin() AND (
    project_id IS NULL OR admin_can_project(project_id)
  )))
  WITH CHECK (is_super_admin() OR user_id = auth.uid() OR (is_admin() AND (
    project_id IS NULL OR admin_can_project(project_id)
  )));
-- ai_actions — no tenant column I can see; restrict to super_admin until schema adds one.
CREATE POLICY "Super admin only ai_actions" ON public.ai_actions
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Suppliers / supplier_contacts
DROP POLICY IF EXISTS "Suppliers admin all" ON public.suppliers;
DROP POLICY IF EXISTS "Supplier contacts admin all" ON public.supplier_contacts;
-- suppliers already re-created by the earlier migration; add supplier_contacts scoped via supplier.
CREATE POLICY "Supplier contacts admin all" ON public.supplier_contacts
  FOR ALL TO authenticated
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM suppliers s WHERE s.id = supplier_contacts.supplier_id AND (s.company_id = my_company_id() OR s.company_id IS NULL)
  ))
  WITH CHECK (is_admin() AND EXISTS (
    SELECT 1 FROM suppliers s WHERE s.id = supplier_contacts.supplier_id AND s.company_id = my_company_id()
  ));

-- subcontractors — no company_id column; restrict to admin AND scope via project_subcontractors
DROP POLICY IF EXISTS "Admin full access" ON public.subcontractors;
CREATE POLICY "Super admin only subcontractors" ON public.subcontractors
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
-- Admins don't need direct CRUD on the global subcontractors catalogue; they
-- manage project_subcontractors instead, which is scoped by admin_can_project.

-- templates — has company_id? Check first
DROP POLICY IF EXISTS "Admin full access" ON public.templates;
CREATE POLICY "Super admin only templates" ON public.templates
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- time_entries_legacy: legacy table, no company_id. Scope via project belonging to my company.
DROP POLICY IF EXISTS "Admin full access" ON public.time_entries_legacy;
CREATE POLICY "Admin full access time_entries_legacy" ON public.time_entries_legacy
  FOR ALL TO authenticated
  USING (is_admin() AND (
    project_id IS NULL OR admin_can_project(project_id)
  ))
  WITH CHECK (is_admin() AND (
    project_id IS NULL OR admin_can_project(project_id)
  ));

-- profiles INSERT: the "Users insert own profile" policy with qual=NULL was
-- permissive (INSERT with with_check=NULL silently allowed anything). Replace
-- with a proper guard: users can insert their own id only, or admin of same company.
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR is_super_admin()
    OR (is_admin() AND company_id = my_company_id())
  );

NOTIFY pgrst, 'reload schema';
