-- Fix: time_entries UPDATE policy was preventing clock-out.
--
-- The previous policy used a single USING clause with `clock_out IS NULL`.
-- Postgres defaults WITH CHECK to USING when WITH CHECK is absent, so the
-- USING expression was also applied to the NEW row. When a user clocked out
-- and set clock_out to a timestamp, the NEW row no longer satisfied
-- `clock_out IS NULL`, so the UPDATE was rejected with 403.
--
-- Fix: keep USING restricted to open entries (so users can only mutate their
-- currently-open entry), but add an explicit WITH CHECK that only enforces
-- ownership. Admins (including super_admin) can update any row.

DROP POLICY IF EXISTS "Users update own open entries or admin updates any" ON public.time_entries;

CREATE POLICY "Users update own open entries or admin updates any" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND clock_out IS NULL)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
