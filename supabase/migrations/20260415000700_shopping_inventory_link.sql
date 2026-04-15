-- ============================================================================
-- Inventory × Shopping List Integration (PR 10 of Live Shared Project State /
-- Multi-Location Inventory)
-- ============================================================================
-- Adds optional links from shopping_list_items to the inventory catalog and
-- to a source inventory_locations row. When a shopping item has both links
-- and the admin marks it "delivered" / clicks "deduct from stock", an edge
-- function (deduct-shopping-item-from-stock) inserts an inventory_stocktakes
-- row that pulls the quantity off the source location. The deduction
-- generates an auditable stocktake record.
--
-- Columns:
--   inventory_item_id      — FK to inventory_items; optional catalog link
--   source_location_id     — FK to inventory_locations; where stock is pulled
--   deducted_at            — set once stock has been deducted (idempotency)
--   deducted_stocktake_id  — FK to inventory_stocktakes; audit trail
--
-- No RLS changes. Existing shopping_list_items policies (company / project
-- scoped via can_access_project from PR 1) already cover these columns.
--
-- No triggers altered. Idempotent — safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE shopping_list_items
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID
    REFERENCES inventory_items(id) ON DELETE SET NULL;

ALTER TABLE shopping_list_items
  ADD COLUMN IF NOT EXISTS source_location_id UUID
    REFERENCES inventory_locations(id) ON DELETE SET NULL;

ALTER TABLE shopping_list_items
  ADD COLUMN IF NOT EXISTS deducted_at TIMESTAMPTZ;

ALTER TABLE shopping_list_items
  ADD COLUMN IF NOT EXISTS deducted_stocktake_id UUID
    REFERENCES inventory_stocktakes(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Indexes (partial — cheap since most shopping items aren't linked)
-- ─────────────────────────────────────────────────────────────────────────────

-- Hot path: "what shopping items reference inventory item X?" (e.g. AI agent
-- cross-references, or cleanup on item delete).
CREATE INDEX IF NOT EXISTS shopping_list_items_inventory_item_idx
  ON shopping_list_items(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

-- Hot path: "what pending deductions exist for location Y?" — drives the
-- admin's pending-deduction summary + the deduct-from-stock flow.
CREATE INDEX IF NOT EXISTS shopping_list_items_pending_deduction_idx
  ON shopping_list_items(source_location_id, deducted_at)
  WHERE source_location_id IS NOT NULL AND deducted_at IS NULL;
