-- ============================================================================
-- Fix inventory-alerts-digest cron
-- ============================================================================
-- The cron scheduled by 20260415001200_inventory_notification_cron.sql depends
-- on current_setting('app.supabase_url', true) and current_setting(
-- 'app.service_role_key', true). Those settings are not configured on this
-- database, so every invocation failed with:
--     "null value in column url of relation http_request_queue violates
--      not-null constraint"
--
-- ALTER DATABASE ... SET requires a superuser that the Supabase Management
-- API connection is not. Same fix as reminders-dispatch-every-minute
-- (20260416000000_reminders.sql): hardcode the functions URL and drop the
-- Authorization header. Edge functions deploy with --no-verify-jwt so the
-- cron does not need a JWT; notify-inventory-alerts runs as service_role
-- internally and its send pattern is idempotent within a 24h window.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('inventory-alerts-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('inventory-alerts-digest', '37 13 * * *',
  $$ SELECT net.http_post(
    url := 'https://mebzqfeeiciayxdetteb.supabase.co/functions/v1/notify-inventory-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);
