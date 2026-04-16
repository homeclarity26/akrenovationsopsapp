-- ============================================================================
-- Wave A DB Integrity + RLS Hardening (PR 14)
-- ============================================================================
-- Consolidated migration addressing CRITICAL + MAJOR database-level findings
-- from the 5-agent review. Scope is intentionally limited to SQL — sibling
-- PRs (13 edge functions, 15 frontend) are rolling in parallel.
--
-- Fixes included:
--   1. Stocktake trigger always populates quantity_before (fixes first-count
--      delta NULL bug on (location, item) pairs that have never been counted).
--   2. Activity trigger skips updated_at-only UPDATEs (kills feed noise from
--      housekeeping bumps); also WARNs instead of silently returning when
--      v_project_id is NULL.
--   3. visible_to_client backfilled to TRUE for legacy (pre-PR-4) content on
--      the 6 tables PR 4 added the flag to.
--   4. inventory_alerts unique index now covers status IN ('open',
--      'acknowledged') instead of 'open' only — prevents dup alerts while
--      the admin is sitting on an acknowledgement.
--   5. inventory_stock gains a created_at column for consistency with siblings.
--   6. ai_project_suggestions.proposed_action gets a JSONB shape CHECK so
--      malformed payloads inserted via direct SQL can't crash the apply flow.
--   7. Storage policies on the stocktake-photos bucket use the is_admin()
--      helper (which has SET search_path = public) instead of inline EXISTS,
--      bringing them in line with the rest of the codebase.
--   8. (Safety) Cross-company validation trigger on shopping_list_items
--      inventory links prevents a user on project A from linking to an
--      inventory_item or location belonging to company B.
--
-- Idempotent — every CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS /
-- DROP ... IF EXISTS / CREATE INDEX IF NOT EXISTS pattern. Safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: inventory_stocktake_capture_before() — always set quantity_before
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: the original function only filled quantity_before if the caller
-- left it NULL. For first-ever stocktakes of a (location, item) pair, the
-- caller may pass NULL but there's no matching inventory_stock row to fall
-- back to — leaving quantity_before NULL and therefore the GENERATED `delta`
-- column NULL. That breaks the audit trail.
--
-- Fix: always overwrite NEW.quantity_before from the current
-- inventory_stock.quantity (defaulting to 0 if no row exists). Removes the
-- "only if caller didn't set it" guard. Also adds SECURITY DEFINER + an
-- explicit search_path to match the sibling apply function.

CREATE OR REPLACE FUNCTION inventory_stocktake_capture_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing NUMERIC;
BEGIN
  -- Always pull the authoritative "before" from inventory_stock, defaulting
  -- to 0 for (location, item) pairs that have never been stocked. This
  -- guarantees the GENERATED `delta` column is never NULL.
  SELECT quantity INTO v_existing
  FROM inventory_stock
  WHERE location_id = NEW.location_id AND item_id = NEW.item_id;

  NEW.quantity_before := COALESCE(v_existing, 0);

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 2: log_project_activity() — skip noise-only UPDATEs + WARN on NULL project
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem A: the trigger logs "Edited a <thing>" on EVERY UPDATE, including
-- rows that only got their updated_at bumped by another BEFORE UPDATE trigger
-- (every table in the system has one). Activity feed fills with noise.
--
-- Problem B: if v_project_id ends up NULL, the trigger silently returns —
-- which hides real bugs. Should WARN so the issue is visible in logs but
-- doesn't break the caller.
--
-- Fix: compare OLD and NEW as JSONB minus updated_at/created_at; if there's
-- no meaningful change, RETURN early. Also RAISE WARNING when v_project_id
-- is NULL instead of silently dropping.

CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_entity_id UUID;
  v_activity_type TEXT;
  v_summary TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_actor_id UUID;
  v_actor_type TEXT;
BEGIN
  -- Short-circuit: noise-only UPDATEs (nothing changed except updated_at /
  -- created_at). Has to run BEFORE any other logic touches NEW/OLD.
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'updated_at' - 'created_at')
       = (to_jsonb(OLD) - 'updated_at' - 'created_at') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Resolve actor
  v_actor_id := auth.uid();
  v_actor_type := CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'user' END;

  -- Resolve project_id and entity_id (project table uses id as both)
  IF TG_TABLE_NAME = 'projects' THEN
    v_project_id := COALESCE(NEW.id, OLD.id);
    v_entity_id := v_project_id;
  ELSE
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
    v_entity_id := COALESCE(NEW.id, OLD.id);
  END IF;

  -- WARN on NULL project_id (was silent; hiding real bugs) but don't block
  -- the write — the activity log is secondary to the underlying mutation.
  IF v_project_id IS NULL THEN
    RAISE WARNING
      'log_project_activity: NULL project_id on table % op %',
      TG_TABLE_NAME, TG_OP;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve activity_type from TG_OP + special cases (status transitions)
  IF TG_OP = 'INSERT' THEN
    v_activity_type := 'created';
  ELSIF TG_OP = 'DELETE' THEN
    v_activity_type := 'deleted';
  ELSE
    v_activity_type := 'updated';
  END IF;

  -- Build per-table summary + override activity_type for status changes etc.
  CASE TG_TABLE_NAME
    WHEN 'daily_logs' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Logged daily update: ' || LEFT(NEW.summary, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted a daily log';
      ELSE
        v_summary := 'Edited a daily log';
      END IF;

    WHEN 'tasks' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added task: ' || LEFT(NEW.title, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted task: ' || LEFT(OLD.title, 80);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := CASE
          WHEN NEW.status = 'done' THEN 'completed'
          ELSE 'status_changed'
        END;
        v_summary := 'Task "' || LEFT(NEW.title, 60) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited task: ' || LEFT(NEW.title, 80);
      END IF;

    WHEN 'change_orders' THEN
      IF TG_OP = 'INSERT' THEN
        v_activity_type := 'flagged';
        v_summary := 'Flagged change order: ' || LEFT(NEW.title, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted change order: ' || LEFT(OLD.title, 80);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := 'Change order "' || LEFT(NEW.title, 50) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited change order: ' || LEFT(NEW.title, 80);
      END IF;

    WHEN 'punch_list_items' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added punch item: ' || LEFT(NEW.description, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted punch item';
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := CASE
          WHEN NEW.status = 'complete' THEN 'completed'
          ELSE 'status_changed'
        END;
        v_summary := 'Punch item "' || LEFT(NEW.description, 50) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited punch item';
      END IF;

    WHEN 'warranty_claims' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Filed warranty claim: ' || LEFT(NEW.description, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted warranty claim';
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := 'Warranty claim → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited warranty claim';
      END IF;

    WHEN 'project_photos' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added a photo' || COALESCE(' — ' || LEFT(NEW.caption, 60), '');
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Removed a photo';
      ELSE
        v_summary := 'Edited a photo';
      END IF;

    WHEN 'shopping_list_items' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added to shopping list: ' || LEFT(NEW.item_name, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Removed from shopping list: ' || LEFT(OLD.item_name, 80);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := '"' || LEFT(NEW.item_name, 50) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited shopping list item';
      END IF;

    WHEN 'messages' THEN
      -- Messages are write-only in practice; only log INSERT.
      IF TG_OP <> 'INSERT' THEN
        RETURN COALESCE(NEW, OLD);
      END IF;
      v_activity_type := 'commented';
      v_summary := 'Sent a message: ' || LEFT(NEW.message, 100);
      IF NEW.is_ai_generated IS TRUE THEN
        v_actor_type := 'ai';
      END IF;

    WHEN 'project_assignments' THEN
      IF TG_OP = 'INSERT' THEN
        v_activity_type := 'assigned';
        v_summary := 'Assigned someone to the project as ' || NEW.role;
        v_metadata := jsonb_build_object('employee_id', NEW.employee_id, 'role', NEW.role);
      ELSIF TG_OP = 'DELETE' THEN
        v_activity_type := 'unassigned';
        v_summary := 'Removed someone from the project';
        v_metadata := jsonb_build_object('employee_id', OLD.employee_id);
      ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
        IF NEW.active = false THEN
          v_activity_type := 'unassigned';
          v_summary := 'Removed someone from the project';
        ELSE
          v_activity_type := 'assigned';
          v_summary := 'Re-added someone to the project as ' || NEW.role;
        END IF;
        v_metadata := jsonb_build_object('employee_id', NEW.employee_id);
      ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
        v_summary := 'Changed role to ' || NEW.role;
        v_metadata := jsonb_build_object('from', OLD.role, 'to', NEW.role, 'employee_id', NEW.employee_id);
      ELSE
        -- other edits (e.g. updated_at bumps) — skip noise
        RETURN COALESCE(NEW, OLD);
      END IF;

    WHEN 'projects' THEN
      IF TG_OP = 'DELETE' THEN
        -- Project itself is going away; cascade will drop the activity anyway.
        RETURN OLD;
      END IF;
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Project created';
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := 'Project status → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSIF NEW.percent_complete IS DISTINCT FROM OLD.percent_complete THEN
        -- Progress ticks are noisy; only log at 25/50/75/100 boundaries
        IF NEW.percent_complete NOT IN (25, 50, 75, 100) THEN
          RETURN NEW;
        END IF;
        v_summary := 'Project progress → ' || NEW.percent_complete || '%';
        v_metadata := jsonb_build_object('from', OLD.percent_complete, 'to', NEW.percent_complete);
      ELSE
        -- Skip other project-row edits as noise
        RETURN NEW;
      END IF;

    ELSE
      -- Unknown table — skip quietly so adding a trigger by mistake doesn't
      -- spam garbage rows.
      RETURN COALESCE(NEW, OLD);
  END CASE;

  INSERT INTO project_activity (
    project_id, actor_id, actor_type, activity_type,
    entity_table, entity_id, summary, metadata
  ) VALUES (
    v_project_id, v_actor_id, v_actor_type, v_activity_type,
    TG_TABLE_NAME, v_entity_id, v_summary, v_metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 3: visible_to_client backfill for pre-PR-4 rows
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: PR 4 added visible_to_client BOOLEAN NOT NULL DEFAULT false on six
-- content tables. Every row that existed before PR 4 landed got false, which
-- means clients on existing projects see *nothing* until an admin toggles
-- each row individually. That's the opposite of what admins expect.
--
-- Fix: set visible_to_client = true for every pre-cutoff row (created_at <
-- '2026-04-15'). Admins can still hide specific items. Idempotent — the
-- UPDATE only touches rows still at false, so re-running is a no-op.

UPDATE shopping_list_items
   SET visible_to_client = true
 WHERE visible_to_client = false AND created_at < '2026-04-15';

UPDATE project_photos
   SET visible_to_client = true
 WHERE visible_to_client = false AND created_at < '2026-04-15';

UPDATE change_orders
   SET visible_to_client = true
 WHERE visible_to_client = false AND created_at < '2026-04-15';

UPDATE punch_list_items
   SET visible_to_client = true
 WHERE visible_to_client = false AND created_at < '2026-04-15';

UPDATE daily_logs
   SET visible_to_client = true
 WHERE visible_to_client = false AND created_at < '2026-04-15';

UPDATE warranty_claims
   SET visible_to_client = true
 WHERE visible_to_client = false AND created_at < '2026-04-15';

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 4: inventory_alerts — dedup across 'open' AND 'acknowledged'
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: the PR 11 partial unique index only covered WHERE status = 'open'.
-- Once the admin acknowledges an alert (not yet resolved), the next daily
-- scan can insert a duplicate open row for the same (item_id, alert_type).
--
-- Fix: drop the old index and recreate covering both active statuses.

DROP INDEX IF EXISTS inventory_alerts_open_unique;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_alerts_active_unique
  ON inventory_alerts(item_id, alert_type)
  WHERE status IN ('open', 'acknowledged');

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 5: inventory_stock.created_at
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: the table only has updated_at. You can't tell when a
-- (location, item) pair first got stocked, which matters for audit / age of
-- oldest stock reports.
--
-- Fix: add created_at with the standard default. NOT NULL is safe because
-- every existing row backfills with now() at migration time.

ALTER TABLE inventory_stock
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 6: ai_project_suggestions.proposed_action JSONB shape CHECK
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: proposed_action is JSONB with no constraint. Malformed payloads
-- inserted via direct SQL (bypassing the edge function's Zod validation)
-- break the apply-suggestion function at runtime.
--
-- Fix: add a CHECK that enforces the two required keys and a valid operation.
-- Guarded with pg_constraint lookup so the ADD CONSTRAINT is idempotent
-- (ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS in Postgres 15).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_project_suggestions_proposed_action_shape'
  ) THEN
    ALTER TABLE ai_project_suggestions
      ADD CONSTRAINT ai_project_suggestions_proposed_action_shape
      CHECK (
        (proposed_action ? 'table')
        AND (proposed_action ? 'operation')
        AND ((proposed_action->>'operation') IN ('insert', 'update'))
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 7: storage policies on stocktake-photos use is_admin()
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: the PR 12 admin SELECT/DELETE policies inline an EXISTS query on
-- profiles without SET search_path. Elsewhere in the codebase the convention
-- is to use is_admin() (which has SET search_path = public and is
-- SECURITY DEFINER + STABLE). Inconsistent + slightly less safe.
--
-- Fix: drop the existing admin policies (names match PR 12 exactly —
-- "Admins read any stocktake photo" and "Admins delete stocktake photos")
-- and recreate using is_admin().

DROP POLICY IF EXISTS "Admins read any stocktake photo" ON storage.objects;
CREATE POLICY "Admins read any stocktake photo" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stocktake-photos' AND is_admin());

DROP POLICY IF EXISTS "Admins delete stocktake photos" ON storage.objects;
CREATE POLICY "Admins delete stocktake photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stocktake-photos' AND is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 8: cross-company validation for shopping_list_items inventory links
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: shopping_list_items.inventory_item_id / source_location_id are
-- plain FKs — the database accepts any UUID referencing the parent tables
-- regardless of company. A user with access to project A (company X) could
-- set inventory_item_id to a row from company Y, leaking data and potentially
-- allowing deductions against another tenant's inventory via the
-- deduct-shopping-item-from-stock edge function.
--
-- Fix: BEFORE INSERT OR UPDATE OF (inventory_item_id, source_location_id)
-- trigger that compares the linked item's / location's company_id to the
-- project's company_id and raises on mismatch. SECURITY DEFINER + explicit
-- search_path so it works regardless of caller (including RLS-scoped users).

CREATE OR REPLACE FUNCTION validate_shopping_inventory_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_company  UUID;
  v_item_company     UUID;
  v_location_company UUID;
BEGIN
  -- No links → nothing to validate.
  IF NEW.inventory_item_id IS NULL AND NEW.source_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.company_id INTO v_project_company
    FROM projects p
   WHERE p.id = NEW.project_id;

  IF v_project_company IS NULL THEN
    RAISE EXCEPTION
      'shopping_list_items.project_id % has no matching project', NEW.project_id;
  END IF;

  IF NEW.inventory_item_id IS NOT NULL THEN
    SELECT company_id INTO v_item_company
      FROM inventory_items
     WHERE id = NEW.inventory_item_id;

    IF v_item_company IS NULL THEN
      RAISE EXCEPTION
        'inventory_item_id % not found', NEW.inventory_item_id;
    END IF;

    IF v_item_company <> v_project_company THEN
      RAISE EXCEPTION
        'inventory_item_id belongs to a different company';
    END IF;
  END IF;

  IF NEW.source_location_id IS NOT NULL THEN
    SELECT company_id INTO v_location_company
      FROM inventory_locations
     WHERE id = NEW.source_location_id;

    IF v_location_company IS NULL THEN
      RAISE EXCEPTION
        'source_location_id % not found', NEW.source_location_id;
    END IF;

    IF v_location_company <> v_project_company THEN
      RAISE EXCEPTION
        'source_location_id belongs to a different company';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shopping_inventory_scope ON shopping_list_items;
CREATE TRIGGER trg_validate_shopping_inventory_scope
  BEFORE INSERT OR UPDATE OF inventory_item_id, source_location_id
  ON shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_shopping_inventory_scope();
