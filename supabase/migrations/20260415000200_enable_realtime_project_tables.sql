-- ============================================================================
-- Enable Supabase Realtime on project-scoped tables (PR 2 of Live Shared State)
-- ============================================================================
-- Supabase Realtime only broadcasts changes for tables added to the
-- `supabase_realtime` publication. The default publication in a fresh project
-- includes everything, but any time a table is created outside the Supabase
-- Studio UI (e.g. via migration), it must be added explicitly to start
-- emitting postgres_changes events.
--
-- This migration adds every table that the admin ProjectDetailPage and the
-- upcoming employee ProjectDetail subscribe to. Idempotent — re-adding a
-- table to a publication that already has it raises an error, so we wrap in
-- IF NOT EXISTS via pg_publication_tables.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  realtime_tables TEXT[] := ARRAY[
    'projects',
    'project_phases',
    'project_assignments',
    'tasks',
    'daily_logs',
    'change_orders',
    'punch_list_items',
    'warranty_claims',
    'project_photos',
    'project_files',
    'shopping_list_items',
    'messages',
    'expenses',
    'schedule_events'
  ];
BEGIN
  -- Ensure the publication exists (Supabase cloud creates it, but be safe)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  FOREACH t IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;

    -- REPLICA IDENTITY FULL ensures UPDATE events include the full OLD row,
    -- which is required for Supabase's filter-based subscriptions to work
    -- reliably on UPDATEs (otherwise filters can miss rows whose filtered
    -- column didn't change).
    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
