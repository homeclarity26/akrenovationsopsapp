-- ============================================================================
-- Inventory Notification Cron (PR 18 — low-stock email digest)
-- ============================================================================
-- Schedules notify-inventory-alerts to run at 13:37 UTC (8:37 Eastern)
-- which is ~15 minutes after agent-inventory-alerts completes its daily
-- scan (22). Picking :37 keeps us off the :00/:22/:30 marks already used.
--
-- Idempotent: unschedules first, then (re)schedules.
-- No table/schema changes — cron only.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('inventory-alerts-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('inventory-alerts-digest', '37 13 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/notify-inventory-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) $$
);
