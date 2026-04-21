-- project_assignments — employees can read their own.
--
-- Discovered while smoking the AI v2 clock_in tool: the only existing
-- policy on this table is "Admin manages project_assignments" (ALL gated
-- by admin_can_project). When an employee's JWT does a direct SELECT,
-- they get 0 rows — RLS blocks. The current app worked around this via
-- SECURITY DEFINER helpers (is_assigned_to_project, employee_can_project)
-- which bypass RLS, but any tool/edge-function reading assignments from
-- the user's session was silently empty.
--
-- This adds a SELECT policy so employees can read their own assignment
-- rows. Doesn't widen anything — admins keep their existing ALL policy.

BEGIN;

CREATE POLICY "Employees read own project_assignments"
  ON public.project_assignments FOR SELECT
  USING (employee_id = auth.uid());

COMMIT;
