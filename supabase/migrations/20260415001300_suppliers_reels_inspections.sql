-- ============================================================================
-- Wave B / PR 19: Suppliers + Progress Reels + Inspection Reports
-- ============================================================================
-- Ships three deferred features:
--   1. suppliers / supplier_contacts — admin-managed vendor directory
--      (also adds missing columns to the legacy K19 suppliers table)
--   2. project_reels — AI-generated progress reel manifests per project
--   3. inspection_reports — building inspection records (framing, electrical,
--      final, etc.) surfaced on the project Warranty tab
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Shared helper: bump updated_at()
-- ─────────────────────────────────────────────────────────────────────────────
-- Reuse inventory_set_updated_at() from the inventory migration if it exists;
-- otherwise create a local one. Named pr19_set_updated_at to avoid collisions.

CREATE OR REPLACE FUNCTION pr19_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. suppliers — extend the legacy K19 table with the columns PR 19 needs
-- ─────────────────────────────────────────────────────────────────────────────
-- The K19 migration already created suppliers without company_id, name, or
-- the preferred/is_active flags PR 19 uses. Add anything missing, keep
-- everything that's already there. Existing rows (if any) get backfilled
-- safely with defaults.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS preferred BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Backfill `name` from the legacy `company_name` column if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'company_name'
  ) THEN
    EXECUTE 'UPDATE suppliers SET name = company_name WHERE name IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'contact_name'
  ) THEN
    EXECUTE 'UPDATE suppliers SET primary_contact_name = contact_name WHERE primary_contact_name IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'is_preferred'
  ) THEN
    EXECUTE 'UPDATE suppliers SET preferred = COALESCE(is_preferred, false)';
  END IF;

  -- Backfill company_id to the AK Renovations company if it exists so old rows
  -- don't become orphans. New rows must supply company_id explicitly.
  UPDATE suppliers
  SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
  WHERE company_id IS NULL;
END $$;

-- Indexes for the new access patterns.
CREATE INDEX IF NOT EXISTS suppliers_company_active_idx
  ON suppliers(company_id, is_active);

CREATE INDEX IF NOT EXISTS suppliers_category_active_idx
  ON suppliers(category) WHERE is_active;

-- (company_id, name) must be unique per company. Only apply when name is set.
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_company_name_uniq
  ON suppliers(company_id, name)
  WHERE name IS NOT NULL;

-- Bump updated_at on edits.
DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION pr19_set_updated_at();

-- RLS — admin CRUD on their company; employees read-only on their company.
-- Drop the legacy "admin-only" policy first (from K19) so we can layer in
-- employee reads.
DROP POLICY IF EXISTS suppliers_admin_all ON suppliers;
DROP POLICY IF EXISTS "Admin full access" ON suppliers;
DROP POLICY IF EXISTS "Suppliers admin all" ON suppliers;
DROP POLICY IF EXISTS "Suppliers employee read" ON suppliers;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers admin all" ON suppliers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Suppliers employee read" ON suppliers
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Realtime + replica identity so admin UI reacts instantly to changes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'suppliers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
  END IF;
  EXECUTE 'ALTER TABLE suppliers REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. supplier_contacts — additional people at a supplier
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_contacts_supplier_idx
  ON supplier_contacts(supplier_id);

DROP TRIGGER IF EXISTS trg_supplier_contacts_updated_at ON supplier_contacts;
CREATE TRIGGER trg_supplier_contacts_updated_at
  BEFORE UPDATE ON supplier_contacts
  FOR EACH ROW EXECUTE FUNCTION pr19_set_updated_at();

ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supplier contacts admin all" ON supplier_contacts;
CREATE POLICY "Supplier contacts admin all" ON supplier_contacts
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Supplier contacts employee read" ON supplier_contacts;
CREATE POLICY "Supplier contacts employee read" ON supplier_contacts
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = supplier_contacts.supplier_id
        AND s.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'supplier_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE supplier_contacts;
  END IF;
  EXECUTE 'ALTER TABLE supplier_contacts REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. project_reels — stored output of generate-progress-reel
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per generated reel. manifest is a JSON blob listing the photos
-- (url, caption, taken_at, category) in playback order. narrative is a
-- 2-paragraph AI-written summary that appears above the photo strip.
-- visible_to_client gates whether clients see the reel in their portal.

CREATE TABLE IF NOT EXISTS project_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT,
  manifest JSONB NOT NULL,
  narrative TEXT,
  visible_to_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_reels_project_created_idx
  ON project_reels(project_id, created_at DESC);

ALTER TABLE project_reels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project reels read" ON project_reels;
CREATE POLICY "Project reels read" ON project_reels
  FOR SELECT TO authenticated
  USING (
    can_access_project(project_id)
    AND (
      -- Admin/employees: always see reels for accessible projects.
      is_employee_or_admin()
      -- Clients: only reels explicitly marked visible.
      OR visible_to_client = true
    )
  );

DROP POLICY IF EXISTS "Project reels admin write" ON project_reels;
CREATE POLICY "Project reels admin write" ON project_reels
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_reels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_reels;
  END IF;
  EXECUTE 'ALTER TABLE project_reels REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. inspection_reports — building inspections per project
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors the daily_logs access model: anyone who can_access_project can read;
-- admins do full CRUD; assigned employees can insert. The agent-inspection-
-- analyzer edge function reacts to photo attachments via a separate trigger
-- (not wired in this migration).

CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL,
  inspector_name TEXT,
  inspector_org TEXT,
  inspection_date DATE NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pass', 'fail', 'conditional', 'pending')),
  notes TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  follow_up_required BOOLEAN NOT NULL DEFAULT false,
  follow_up_notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_reports_project_date_idx
  ON inspection_reports(project_id, inspection_date DESC);

-- Fast lookup for "what still needs attention" (anything not passed).
CREATE INDEX IF NOT EXISTS inspection_reports_result_open_idx
  ON inspection_reports(result) WHERE result != 'pass';

DROP TRIGGER IF EXISTS trg_inspection_reports_updated_at ON inspection_reports;
CREATE TRIGGER trg_inspection_reports_updated_at
  BEFORE UPDATE ON inspection_reports
  FOR EACH ROW EXECUTE FUNCTION pr19_set_updated_at();

ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inspection reports read" ON inspection_reports;
CREATE POLICY "Inspection reports read" ON inspection_reports
  FOR SELECT TO authenticated
  USING (can_access_project(project_id));

DROP POLICY IF EXISTS "Inspection reports admin write" ON inspection_reports;
CREATE POLICY "Inspection reports admin write" ON inspection_reports
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Assigned employees can log inspections from the field. Mirrors the
-- daily_logs write pattern. UPDATE/DELETE stays admin-only.
DROP POLICY IF EXISTS "Inspection reports employee insert" ON inspection_reports;
CREATE POLICY "Inspection reports employee insert" ON inspection_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin()
    AND can_access_project(project_id)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inspection_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inspection_reports;
  END IF;
  EXECUTE 'ALTER TABLE inspection_reports REPLICA IDENTITY FULL';
END $$;
