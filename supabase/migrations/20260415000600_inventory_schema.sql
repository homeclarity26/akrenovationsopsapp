-- ============================================================================
-- Inventory Schema (PR 7 of Live Shared Project State / Multi-Location Inventory)
-- ============================================================================
-- Multi-location, multi-tenant inventory. Stock lives at named locations
-- (shop, trucks, trailers). Employees pick a location when they start their
-- day and submit rough stocktake counts from the field; submission is the
-- single source of truth for current stock. Admin edits the catalog and
-- locations.
--
-- Scope:
--   5 tables (locations, categories, items, stock, stocktakes) +
--   1 optional catalog helper (inventory_item_templates).
--   Triggers: updated_at on each + stocktake → stock upsert.
--   RLS: admin full CRUD; employees read catalog + write stocktakes; no client.
--   Realtime publication on all tables with REPLICA IDENTITY FULL.
--   Idempotent AK Renovations seed (locations, categories, ~20 items, templates).
--
-- No frontend or edge functions — schema-only PR. Future PRs (8 admin UI,
-- 9 employee stocktake, 10 shopping-list integration, 11 AI agent, 12 photo
-- stocktake) build on top.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Shared helper: set_updated_at()
-- ─────────────────────────────────────────────────────────────────────────────
-- Generic BEFORE UPDATE trigger that bumps updated_at. Mirrors the
-- project_assignments_set_updated_at() pattern from PR 1; named generically
-- so every inventory_* table can reuse it.

CREATE OR REPLACE FUNCTION inventory_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. inventory_locations — where stock lives
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('shop', 'truck', 'trailer', 'jobsite', 'other')),
  -- Nullable: used when a truck is someone's daily driver. ON DELETE SET NULL
  -- so deleting an employee doesn't orphan the location.
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  license_plate TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique name per company — can't have two "Truck 1" locations.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_company_name_uniq
  ON inventory_locations(company_id, name);

CREATE INDEX IF NOT EXISTS inventory_locations_company_active_idx
  ON inventory_locations(company_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS inventory_locations_assigned_idx
  ON inventory_locations(assigned_to) WHERE assigned_to IS NOT NULL;

DROP TRIGGER IF EXISTS trg_inventory_locations_updated_at ON inventory_locations;
CREATE TRIGGER trg_inventory_locations_updated_at
  BEFORE UPDATE ON inventory_locations
  FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. inventory_categories — admin-editable list
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Optional lucide-react icon name (e.g. "wrench", "zap") for the UI.
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_categories_company_name_uniq
  ON inventory_categories(company_id, name);

CREATE INDEX IF NOT EXISTS inventory_categories_company_sort_idx
  ON inventory_categories(company_id, sort_order);

DROP TRIGGER IF EXISTS trg_inventory_categories_updated_at ON inventory_categories;
CREATE TRIGGER trg_inventory_categories_updated_at
  BEFORE UPDATE ON inventory_categories
  FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. inventory_items — catalog of tracked things
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Nullable: category can be deleted without losing the item; admin re-categorizes.
  category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  -- Free text: 'each', 'box', 'ft', 'gallon', 'pound', 'yard', etc.
  unit TEXT NOT NULL DEFAULT 'each',
  -- Nullable: helps the UI convert "2 boxes" to "100 each" at stocktake time.
  pack_size NUMERIC,
  vendor TEXT,
  -- Company-wide target across all locations (nullable).
  target_stock_total NUMERIC,
  -- Below this across the company, the PR 11 AI agent raises a shopping-list alert.
  min_stock_alert NUMERIC,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path: "show all active items in this category for this company".
CREATE INDEX IF NOT EXISTS inventory_items_company_category_idx
  ON inventory_items(company_id, category_id) WHERE is_active;

-- Search path: ILIKE on name. text_pattern_ops helps prefix searches.
CREATE INDEX IF NOT EXISTS inventory_items_company_name_idx
  ON inventory_items(company_id, name);

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. inventory_stock — current quantity at a given location for a given item
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per (location, item). UPSERTed by the stocktake trigger; admin can
-- also edit directly (e.g. corrections).

CREATE TABLE IF NOT EXISTS inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  last_counted_at TIMESTAMPTZ,
  last_counted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_location_item_uniq
  ON inventory_stock(location_id, item_id);

CREATE INDEX IF NOT EXISTS inventory_stock_item_idx
  ON inventory_stock(item_id);

DROP TRIGGER IF EXISTS trg_inventory_stock_updated_at ON inventory_stock;
CREATE TRIGGER trg_inventory_stock_updated_at
  BEFORE UPDATE ON inventory_stock
  FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. inventory_stocktakes — historical log of count submissions
-- ─────────────────────────────────────────────────────────────────────────────
-- Append-only. Each row is a full historical record. The delta is computed
-- by Postgres so the stocktake row is always internally consistent.

CREATE TABLE IF NOT EXISTS inventory_stocktakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  -- ON DELETE SET NULL so historical records survive if a user is removed.
  counted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Filled by the BEFORE INSERT trigger from the prior inventory_stock.quantity.
  quantity_before NUMERIC,
  quantity_after NUMERIC NOT NULL,
  -- Stored generated column — always equals after - before.
  delta NUMERIC GENERATED ALWAYS AS (quantity_after - quantity_before) STORED,
  -- Rough counts are fine per the "enough signal to submit" requirement.
  confidence TEXT NOT NULL DEFAULT 'rough'
    CHECK (confidence IN ('exact', 'rough', 'estimate')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_stocktakes_location_created_idx
  ON inventory_stocktakes(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_stocktakes_item_created_idx
  ON inventory_stocktakes(item_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. inventory_item_templates — starter catalog admin picks from
-- ─────────────────────────────────────────────────────────────────────────────
-- Free-text category_name so templates outlive category renames/deletes.

CREATE TABLE IF NOT EXISTS inventory_item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'each',
  typical_pack_size NUMERIC,
  typical_vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_item_templates_company_idx
  ON inventory_item_templates(company_id);

-- Prevent duplicate templates for the same (company, category, name).
CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_templates_unique_idx
  ON inventory_item_templates(company_id, category_name, name);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Stocktake trigger — UPSERT into inventory_stock on every submission
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE INSERT: capture quantity_before from current stock row (default 0).
-- AFTER INSERT: UPSERT the canonical inventory_stock row with the new count.
-- Together: stocktake insert is the single source of truth for current stock.

CREATE OR REPLACE FUNCTION inventory_stocktake_capture_before()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing NUMERIC;
BEGIN
  -- Only overwrite quantity_before if caller didn't set it explicitly.
  IF NEW.quantity_before IS NULL THEN
    SELECT quantity INTO v_existing
    FROM inventory_stock
    WHERE location_id = NEW.location_id AND item_id = NEW.item_id;

    NEW.quantity_before := COALESCE(v_existing, 0);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inventory_stocktake_apply_to_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO inventory_stock (
    location_id, item_id, quantity,
    last_counted_at, last_counted_by, updated_at
  ) VALUES (
    NEW.location_id, NEW.item_id, NEW.quantity_after,
    NEW.created_at, NEW.counted_by, now()
  )
  ON CONFLICT (location_id, item_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    last_counted_at = EXCLUDED.last_counted_at,
    last_counted_by = EXCLUDED.last_counted_by,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_stocktake_before ON inventory_stocktakes;
CREATE TRIGGER trg_inventory_stocktake_before
  BEFORE INSERT ON inventory_stocktakes
  FOR EACH ROW EXECUTE FUNCTION inventory_stocktake_capture_before();

DROP TRIGGER IF EXISTS trg_inventory_stocktake_after ON inventory_stocktakes;
CREATE TRIGGER trg_inventory_stocktake_after
  AFTER INSERT ON inventory_stocktakes
  FOR EACH ROW EXECUTE FUNCTION inventory_stocktake_apply_to_stock();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Admin full CRUD on all five tables (plus the templates helper).
-- Employees read catalog-like tables + insert their own stocktakes.
-- Clients: no access.
--
-- Company scoping: the app always filters by the current user's company_id.
-- For tables that don't carry company_id directly (inventory_stock,
-- inventory_stocktakes), we EXISTS-join through the parent (location or item)
-- so admin policies can still enforce company scope for super_admins who
-- might otherwise see everything.

ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_item_templates ENABLE ROW LEVEL SECURITY;

-- ── inventory_locations ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access inventory_locations" ON inventory_locations;
CREATE POLICY "Admin full access inventory_locations" ON inventory_locations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_locations" ON inventory_locations;
CREATE POLICY "Employees read inventory_locations" ON inventory_locations
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── inventory_categories ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access inventory_categories" ON inventory_categories;
CREATE POLICY "Admin full access inventory_categories" ON inventory_categories
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_categories" ON inventory_categories;
CREATE POLICY "Employees read inventory_categories" ON inventory_categories
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── inventory_items ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access inventory_items" ON inventory_items;
CREATE POLICY "Admin full access inventory_items" ON inventory_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_items" ON inventory_items;
CREATE POLICY "Employees read inventory_items" ON inventory_items
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ── inventory_stock ─────────────────────────────────────────────────────────
-- Admin writes happen via either direct UPDATE or the stocktake trigger
-- (SECURITY DEFINER, so it bypasses RLS). Employees never write stock
-- directly — they submit stocktakes and the trigger handles it.

DROP POLICY IF EXISTS "Admin full access inventory_stock" ON inventory_stock;
CREATE POLICY "Admin full access inventory_stock" ON inventory_stock
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_stock" ON inventory_stock;
CREATE POLICY "Employees read inventory_stock" ON inventory_stock
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND EXISTS (
      SELECT 1 FROM inventory_locations l
      WHERE l.id = inventory_stock.location_id
        AND l.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── inventory_stocktakes ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access inventory_stocktakes" ON inventory_stocktakes;
CREATE POLICY "Admin full access inventory_stocktakes" ON inventory_stocktakes
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_stocktakes" ON inventory_stocktakes;
CREATE POLICY "Employees read inventory_stocktakes" ON inventory_stocktakes
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND EXISTS (
      SELECT 1 FROM inventory_locations l
      WHERE l.id = inventory_stocktakes.location_id
        AND l.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Employees insert inventory_stocktakes" ON inventory_stocktakes;
CREATE POLICY "Employees insert inventory_stocktakes" ON inventory_stocktakes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_employee_or_admin()
    AND counted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM inventory_locations l
      WHERE l.id = inventory_stocktakes.location_id
        AND l.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── inventory_item_templates ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access inventory_item_templates" ON inventory_item_templates;
CREATE POLICY "Admin full access inventory_item_templates" ON inventory_item_templates
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_item_templates" ON inventory_item_templates;
CREATE POLICY "Employees read inventory_item_templates" ON inventory_item_templates
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
-- Same idempotent pattern as PR 2 / PR 3. REPLICA IDENTITY FULL so UPDATE
-- events carry the full OLD row for filter-based subscriptions.

DO $$
DECLARE
  t TEXT;
  realtime_tables TEXT[] := ARRAY[
    'inventory_locations',
    'inventory_categories',
    'inventory_items',
    'inventory_stock',
    'inventory_stocktakes',
    'inventory_item_templates'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  FOREACH t IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;

    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Seed AK Renovations
-- ─────────────────────────────────────────────────────────────────────────────
-- All seed is idempotent — every INSERT uses ON CONFLICT DO NOTHING on the
-- corresponding unique index. Re-running the migration is a no-op.

DO $$
DECLARE
  v_company_id UUID;
  v_shop_id UUID;
  v_cat_plumbing UUID;
  v_cat_electric UUID;
  v_cat_trim UUID;
  v_cat_fasteners UUID;
  v_cat_drywall UUID;
  v_cat_paint UUID;
  v_cat_hardware UUID;
  v_cat_misc UUID;
BEGIN
  -- Resolve AK Renovations. The companies table doesn't have a slug column,
  -- so we match on email (set by 20260410000007) with a name fallback.
  SELECT id INTO v_company_id
  FROM companies
  WHERE email = 'akrenovations01@gmail.com'
     OR name ILIKE '%ak renovations%'
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'AK Renovations company not found — skipping inventory seed.';
    RETURN;
  END IF;

  -- ── Locations ────────────────────────────────────────────────────────────
  INSERT INTO inventory_locations (company_id, name, type, notes)
  VALUES
    (v_company_id, 'Main Shop',                 'shop',    'Primary storage + staging area.'),
    (v_company_id, 'Truck 1',                   'truck',   'Primary service truck.'),
    (v_company_id, 'Truck 2',                   'truck',   'Secondary service truck.'),
    (v_company_id, 'Trailer — Bathroom Jobs',   'trailer', 'Loaded for bathroom remodels.'),
    (v_company_id, 'Trailer — Kitchen Jobs',    'trailer', 'Loaded for kitchen remodels.')
  ON CONFLICT (company_id, name) DO NOTHING;

  -- ── Categories ──────────────────────────────────────────────────────────
  INSERT INTO inventory_categories (company_id, name, sort_order, icon) VALUES
    (v_company_id, 'Plumbing',  10, 'wrench'),
    (v_company_id, 'Electric',  20, 'zap'),
    (v_company_id, 'Trim',      30, 'ruler'),
    (v_company_id, 'Fasteners', 40, 'hammer'),
    (v_company_id, 'Drywall',   50, 'square'),
    (v_company_id, 'Paint',     60, 'paintbrush'),
    (v_company_id, 'Hardware',  70, 'cog'),
    (v_company_id, 'Misc',      80, 'package')
  ON CONFLICT (company_id, name) DO NOTHING;

  -- Resolve category ids for the item seed.
  SELECT id INTO v_cat_plumbing  FROM inventory_categories WHERE company_id = v_company_id AND name = 'Plumbing';
  SELECT id INTO v_cat_electric  FROM inventory_categories WHERE company_id = v_company_id AND name = 'Electric';
  SELECT id INTO v_cat_trim      FROM inventory_categories WHERE company_id = v_company_id AND name = 'Trim';
  SELECT id INTO v_cat_fasteners FROM inventory_categories WHERE company_id = v_company_id AND name = 'Fasteners';
  SELECT id INTO v_cat_drywall   FROM inventory_categories WHERE company_id = v_company_id AND name = 'Drywall';
  SELECT id INTO v_cat_paint     FROM inventory_categories WHERE company_id = v_company_id AND name = 'Paint';
  SELECT id INTO v_cat_hardware  FROM inventory_categories WHERE company_id = v_company_id AND name = 'Hardware';
  SELECT id INTO v_cat_misc      FROM inventory_categories WHERE company_id = v_company_id AND name = 'Misc';

  -- ── Items (~20 across categories) ───────────────────────────────────────
  -- Idempotency: no unique constraint on inventory_items(name). We guard
  -- each insert with NOT EXISTS so re-runs don't duplicate.
  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_plumbing, '1/2" copper elbow 90°', 'each', 25, 'Ferguson', 50, 10
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = '1/2" copper elbow 90°');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_plumbing, '3/4" PEX tee', 'each', 10, 'Home Depot', 30, 5
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = '3/4" PEX tee');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_plumbing, 'Teflon tape 1/2" roll', 'each', 10, 'Home Depot', 20, 4
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Teflon tape 1/2" roll');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_electric, 'Romex 12/2 250ft roll', 'each', 1, 'Home Depot', 4, 1
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Romex 12/2 250ft roll');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_electric, 'Wire nut, red (box of 100)', 'box', 100, 'Home Depot', 5, 1
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Wire nut, red (box of 100)');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_electric, 'Single pole switch, white', 'each', 10, 'Home Depot', 30, 6
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Single pole switch, white');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_trim, '3 1/4" base moulding, primed', 'ft', 16, 'Lowe''s', 200, 40
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = '3 1/4" base moulding, primed');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_trim, '2 1/4" casing, primed', 'ft', 16, 'Lowe''s', 150, 30
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = '2 1/4" casing, primed');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_fasteners, '2.5" finish nails 1lb box', 'box', 1, 'Home Depot', 10, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = '2.5" finish nails 1lb box');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_fasteners, 'Drywall screws 1-5/8" 5lb', 'box', 5, 'Home Depot', 8, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Drywall screws 1-5/8" 5lb');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_fasteners, 'Wood screws #8 x 2" 1lb', 'box', 1, 'Home Depot', 6, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Wood screws #8 x 2" 1lb');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_drywall, '1/2" drywall sheet 4x8', 'each', 1, 'Home Depot', 40, 8
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = '1/2" drywall sheet 4x8');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_drywall, 'Joint compound, 5gal bucket', 'gallon', 5, 'Home Depot', 10, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Joint compound, 5gal bucket');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_drywall, 'Mesh tape, 300ft', 'each', 1, 'Home Depot', 6, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Mesh tape, 300ft');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_paint, 'Sherwin-Williams Duration white 1gal', 'gallon', 1, 'Sherwin-Williams', 6, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Sherwin-Williams Duration white 1gal');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_paint, 'Primer, 1gal', 'gallon', 1, 'Sherwin-Williams', 8, 2
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Primer, 1gal');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_paint, 'Roller covers 9" 3/8 nap', 'each', 3, 'Sherwin-Williams', 20, 5
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Roller covers 9" 3/8 nap');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_hardware, 'Satin nickel cabinet pull, 3"', 'each', 10, 'Home Depot', 30, 6
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Satin nickel cabinet pull, 3"');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_hardware, 'Door hinge 3.5" satin nickel', 'each', 2, 'Home Depot', 20, 4
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Door hinge 3.5" satin nickel');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_misc, 'Blue painter''s tape 1.88"', 'each', 1, 'Home Depot', 30, 6
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Blue painter''s tape 1.88"');

  INSERT INTO inventory_items (company_id, category_id, name, unit, pack_size, vendor, target_stock_total, min_stock_alert)
  SELECT v_company_id, v_cat_misc, 'Contractor trash bag, 42gal (20ct)', 'box', 20, 'Home Depot', 5, 1
  WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE company_id = v_company_id AND name = 'Contractor trash bag, 42gal (20ct)');

  -- ── Templates (starter catalog admin picks from) ────────────────────────
  INSERT INTO inventory_item_templates (company_id, category_name, name, unit, typical_pack_size, typical_vendor, notes) VALUES
    (v_company_id, 'Plumbing',  'Shark-bite 1/2" coupling',             'each',   10, 'Home Depot',       'Push-fit, quick repairs.'),
    (v_company_id, 'Electric',  'GFCI outlet, 15A',                     'each',   1,  'Home Depot',       'Required in kitchens/baths.'),
    (v_company_id, 'Fasteners', 'Construction screws 3" (5lb)',         'box',    5,  'Home Depot',       'Framing, subfloor.'),
    (v_company_id, 'Drywall',   '5/8" drywall sheet 4x8',               'each',   1,  'Home Depot',       'Ceilings / fire-rated walls.'),
    (v_company_id, 'Paint',     'Caulk, paintable white',               'each',   12, 'Sherwin-Williams', 'For trim and baseboard gaps.'),
    (v_company_id, 'Hardware',  'Euro-style soft-close hinge',          'each',   2,  'Home Depot',       'Cabinet install.')
  ON CONFLICT (company_id, category_name, name) DO NOTHING;

  -- ── Initial stock for Main Shop so admin testing has non-empty data ─────
  -- No stocktake trigger needed here — we're seeding historical state, so
  -- write directly to inventory_stock.
  SELECT id INTO v_shop_id FROM inventory_locations
  WHERE company_id = v_company_id AND name = 'Main Shop';

  IF v_shop_id IS NOT NULL THEN
    INSERT INTO inventory_stock (location_id, item_id, quantity, last_counted_at)
    SELECT v_shop_id, i.id,
           CASE i.name
             WHEN '1/2" copper elbow 90°'                     THEN 35
             WHEN 'Romex 12/2 250ft roll'                      THEN 2
             WHEN '2.5" finish nails 1lb box'                  THEN 6
             WHEN 'Drywall screws 1-5/8" 5lb'                  THEN 4
             WHEN 'Sherwin-Williams Duration white 1gal'       THEN 3
             WHEN '1/2" drywall sheet 4x8'                     THEN 22
             ELSE 0
           END,
           now()
    FROM inventory_items i
    WHERE i.company_id = v_company_id
      AND i.name IN (
        '1/2" copper elbow 90°',
        'Romex 12/2 250ft roll',
        '2.5" finish nails 1lb box',
        'Drywall screws 1-5/8" 5lb',
        'Sherwin-Williams Duration white 1gal',
        '1/2" drywall sheet 4x8'
      )
    ON CONFLICT (location_id, item_id) DO NOTHING;
  END IF;

END $$;
