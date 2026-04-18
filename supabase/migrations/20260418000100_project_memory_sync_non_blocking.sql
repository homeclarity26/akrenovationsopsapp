-- ============================================================================
-- Make fn_project_memory_sync() non-blocking on HTTP-post failures
-- ============================================================================
-- Bug found via Golden Path E2E 2026-04-18:
--
--   POST /rest/v1/projects  →  500
--   "null value in column \"url\" of relation \"http_request_queue\"
--    violates not-null constraint"
--
-- Root cause: fn_project_memory_sync() fires on every INSERT / UPDATE-status
-- of projects and calls net.http_post() with
--   url := current_setting('app.supabase_url', true) || '/functions/v1/...'
-- On the live DB the setting `app.supabase_url` is NULL (it's a DB-level
-- GUC that was never `ALTER DATABASE postgres SET ...`'d). NULL || text
-- = NULL, so net.http_post() tries to enqueue a row with url=NULL, hitting
-- the NOT NULL constraint on http_request_queue.url. The exception bubbles
-- up through the AFTER trigger and aborts the INSERT — so creating a
-- project via the UI was completely broken even after the company_id column
-- and the form's project_type/address defaults were fixed.
--
-- The sister trigger on_project_status_checklists() already guards its
-- analogous net.http_post() with BEGIN ... EXCEPTION WHEN OTHERS THEN NULL
-- precisely so an unconfigured environment doesn't block the underlying
-- mutation. Mirror that pattern here.
--
-- The RIGHT long-term fix is also to ALTER DATABASE postgres SET
-- app.supabase_url / app.service_role_key (so the operational memory sync
-- can actually run). That requires superuser privileges the repo PAT
-- doesn't have — do it via the Supabase dashboard's Settings → Database
-- → Extensions or via SQL Editor running as postgres. Once set, this
-- wrapped trigger will start succeeding instead of silently no-oping.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_project_memory_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    BEGIN
      PERFORM net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := jsonb_build_object(
          'entity_type', 'project',
          'entity_id',   NEW.id::text,
          'event',       'status_change',
          'old_value',   OLD.status,
          'new_value',   NEW.status
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Operational memory sync is best-effort; don't block the mutation.
      NULL;
    END;
  END IF;

  IF (TG_OP = 'INSERT') THEN
    BEGIN
      PERFORM net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := jsonb_build_object(
          'entity_type', 'project',
          'entity_id',   NEW.id::text,
          'event',       'project_created',
          'new_value',   NEW.status
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
