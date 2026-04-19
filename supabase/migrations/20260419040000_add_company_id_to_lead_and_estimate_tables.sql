-- Follow-up to 20260419020000 and 20260419030000: tighten the permissive
-- role-only RLS on leads / lead_activities / referral_notifications /
-- estimates to real company scoping, now that we have a safe place to put
-- the column. Without this, any future multi-tenant onboarding would leak
-- these rows across companies.
--
-- Plan per table:
--   1. Add company_id UUID REFERENCES companies(id) ON DELETE CASCADE (nullable).
--   2. Backfill existing rows to the only company that exists today
--      (single-tenant prod). The backfill uses an IN subquery that returns
--      the single row — if we ever reach this migration with >1 company
--      already, it fails loudly rather than picking one arbitrarily.
--   3. Set NOT NULL.
--   4. Add index on company_id (standard for tenant scope).
--   5. Replace the permissive admin policy with a company-scoped version.

-- Guard: this migration only backfills blindly when exactly one company row exists.
DO $$
DECLARE
  company_count int;
BEGIN
  SELECT count(*) INTO company_count FROM companies;
  IF company_count <> 1 THEN
    RAISE EXCEPTION 'Cannot auto-backfill company_id on lead/estimate tables: found % companies (need exactly 1). Backfill manually first.', company_count;
  END IF;
END $$;

-- ── leads ───────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE public.leads SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;

ALTER TABLE public.leads ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads (company_id);

DROP POLICY IF EXISTS "Admin manages leads" ON public.leads;
CREATE POLICY "Admin manages leads" ON public.leads
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = my_company_id())
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- ── lead_activities ─────────────────────────────────────────────────────────
ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Inherit from parent lead where possible.
UPDATE public.lead_activities la
  SET company_id = l.company_id
  FROM public.leads l
  WHERE la.lead_id = l.id AND la.company_id IS NULL;

-- Any orphan rows (shouldn't exist) → the single company.
UPDATE public.lead_activities SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;

ALTER TABLE public.lead_activities ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_activities_company_id ON public.lead_activities (company_id);

DROP POLICY IF EXISTS "Admin manages lead_activities" ON public.lead_activities;
CREATE POLICY "Admin manages lead_activities" ON public.lead_activities
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = my_company_id())
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- ── referral_notifications ──────────────────────────────────────────────────
ALTER TABLE public.referral_notifications
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

UPDATE public.referral_notifications SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;

ALTER TABLE public.referral_notifications ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_notifications_company_id ON public.referral_notifications (company_id);

DROP POLICY IF EXISTS "Admin manages referral_notifications" ON public.referral_notifications;
CREATE POLICY "Admin manages referral_notifications" ON public.referral_notifications
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = my_company_id())
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- ── estimates ───────────────────────────────────────────────────────────────
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Estimates link to a lead, so inherit from lead.company_id where possible.
UPDATE public.estimates e
  SET company_id = l.company_id
  FROM public.leads l
  WHERE e.lead_id = l.id AND e.company_id IS NULL;

UPDATE public.estimates SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;

ALTER TABLE public.estimates ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON public.estimates (company_id);

DROP POLICY IF EXISTS "Admin manages estimates" ON public.estimates;
CREATE POLICY "Admin manages estimates" ON public.estimates
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = my_company_id())
  WITH CHECK (is_admin() AND company_id = my_company_id());

-- ── Auto-populate company_id on INSERT via trigger ──────────────────────────
-- Client code that hasn't been updated yet still inserts without company_id;
-- these triggers fill it from my_company_id() so those inserts don't 403.
CREATE OR REPLACE FUNCTION public.set_company_id_from_caller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_default_company_id ON public.leads;
CREATE TRIGGER leads_default_company_id BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_caller();

DROP TRIGGER IF EXISTS lead_activities_default_company_id ON public.lead_activities;
CREATE TRIGGER lead_activities_default_company_id BEFORE INSERT ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_caller();

DROP TRIGGER IF EXISTS referral_notifications_default_company_id ON public.referral_notifications;
CREATE TRIGGER referral_notifications_default_company_id BEFORE INSERT ON public.referral_notifications
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_caller();

DROP TRIGGER IF EXISTS estimates_default_company_id ON public.estimates;
CREATE TRIGGER estimates_default_company_id BEFORE INSERT ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION set_company_id_from_caller();

NOTIFY pgrst, 'reload schema';
