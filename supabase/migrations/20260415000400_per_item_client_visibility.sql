-- ============================================================================
-- Per-Item Client Visibility (PR 4 of Live Shared Project State)
-- ============================================================================
-- Admin can mark individual rows as visible to the project's client. The
-- client sees ONLY rows explicitly flagged visible_to_client = true. This
-- applies to project-scoped content tables: shopping_list_items,
-- project_photos, change_orders, punch_list_items, daily_logs,
-- warranty_claims.
--
-- project_files ALREADY has `visible_to_client BOOLEAN DEFAULT false` from
-- the base schema (20260407000000_aa_base_schema.sql) and is left alone.
--
-- Each table gets:
--   1. `visible_to_client BOOLEAN NOT NULL DEFAULT false` (idempotent)
--   2. A partial index on (project_id) WHERE visible_to_client — cheap
--      because it only indexes rows where the flag is true.
--   3. A SELECT RLS policy "Clients read visible <table>" that lets the
--      project's client read rows where visible_to_client = true AND they
--      own the project (projects.client_user_id = auth.uid()).
--
-- Admin RLS (full access via is_admin() from M21) and the
-- can_access_project()-based employee policies from PR 1 are unaffected —
-- this migration ONLY adds client SELECT paths.
--
-- The PR 3 project_activity triggers will fire on UPDATE when the toggle
-- flips; that's intentional — the feed will show "edited <entity>" for
-- visibility flips. A future migration can filter visibility-only updates
-- out of the feed if the noise becomes a problem.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add visible_to_client column + partial index + client SELECT policy to
--    each target table.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  target_tables TEXT[] := ARRAY[
    'shopping_list_items',
    'project_photos',
    'change_orders',
    'punch_list_items',
    'daily_logs',
    'warranty_claims'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- 1a. Column
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN NOT NULL DEFAULT false',
      t
    );

    -- 1b. Partial index on project_id where visible (cheap — only indexes
    -- the minority of rows flagged visible)
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I(project_id) WHERE visible_to_client',
      t || '_visible_to_client_idx',
      t
    );

    -- 1c. Client SELECT policy — mirrors the pattern from M21's
    -- client_selections policy: row is visible AND the authed user is the
    -- project's client_user_id.
    EXECUTE format('DROP POLICY IF EXISTS "Clients read visible %s" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "Clients read visible %s" ON %I '
      || 'FOR SELECT TO authenticated '
      || 'USING ( '
      || '  %I.visible_to_client = true '
      || '  AND EXISTS ( '
      || '    SELECT 1 FROM projects p '
      || '    WHERE p.id = %I.project_id '
      || '    AND p.client_user_id = auth.uid() '
      || '  ) '
      || ')',
      t, t, t, t
    );
  END LOOP;
END $$;
