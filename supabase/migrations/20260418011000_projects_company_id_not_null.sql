-- Projects without a company are effectively orphaned — they don't show up
-- in any company-scoped query and violate multi-tenant isolation.
-- All existing rows have company_id set (verified 2026-04-18 before running),
-- so tighten the constraint now to prevent regressions.

DO $$
BEGIN
  -- Only tighten if no nulls exist. Belt-and-suspenders: the app has been
  -- checked and verified, but a concurrent orphan insert during deploy
  -- would otherwise abort the migration mid-way.
  IF EXISTS (SELECT 1 FROM projects WHERE company_id IS NULL) THEN
    RAISE NOTICE 'Skipping NOT NULL tightening: % orphaned projects found',
      (SELECT count(*) FROM projects WHERE company_id IS NULL);
  ELSE
    ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;
