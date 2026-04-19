-- Feature: admin can assign an inventory location to multiple field
-- employees, each of whom then sees that location (and only theirs) on
-- their stocktake page. Realtime is already enabled on inventory_*
-- tables, so updates propagate automatically once the filter lands.
--
-- Implementation: add `assigned_employees uuid[]` alongside the existing
-- single `assigned_to uuid`. Backfill the array from the single column
-- so existing assignments don't regress. Keep `assigned_to` populated
-- with the array's first entry as a convenience for legacy code paths
-- (the employee stocktake "assigned to me" sort uses it) — handled
-- client-side going forward.
--
-- Also adds a GIN index on the array so `auth.uid() = ANY(assigned_employees)`
-- filters stay fast even with many locations per company.

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS assigned_employees uuid[] NOT NULL DEFAULT '{}';

-- Backfill: carry the single assigned_to into the array if present.
UPDATE public.inventory_locations
   SET assigned_employees = ARRAY[assigned_to]
 WHERE assigned_to IS NOT NULL
   AND (assigned_employees IS NULL OR assigned_employees = '{}');

CREATE INDEX IF NOT EXISTS idx_inventory_locations_assigned_employees
  ON public.inventory_locations USING GIN (assigned_employees);

NOTIFY pgrst, 'reload schema';
