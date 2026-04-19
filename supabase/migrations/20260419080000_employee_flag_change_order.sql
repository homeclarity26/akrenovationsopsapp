-- Feature: field employees can flag a running change-order on any project
-- they're assigned to. Admin picks the flag up, prices it, and the existing
-- admin_can_project policy still handles everything from then on.
--
-- Scope:
--   - Employees SELECT change_orders on projects they're assigned to, so the
--     field UI can show a running list of what's been flagged already.
--   - Employees INSERT change_orders only in the 'flagged' status. Pricing,
--     schedule, and approval still require admin.
--
-- Existing policies stay in place (Admin manages, Client read visible).

-- Helper: is the caller assigned to this project?
CREATE OR REPLACE FUNCTION public.employee_can_project(p_project_id uuid)
RETURNS bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_assignments pa
    WHERE pa.project_id = p_project_id
      AND pa.employee_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.employee_can_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "Employees read assigned change_orders" ON public.change_orders;
CREATE POLICY "Employees read assigned change_orders" ON public.change_orders
  FOR SELECT TO authenticated
  USING (employee_can_project(project_id));

DROP POLICY IF EXISTS "Employees flag change_orders" ON public.change_orders;
CREATE POLICY "Employees flag change_orders" ON public.change_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_can_project(project_id)
    AND COALESCE(status, 'flagged') = 'flagged'
    AND flagged_by = auth.uid()
  );

NOTIFY pgrst, 'reload schema';
