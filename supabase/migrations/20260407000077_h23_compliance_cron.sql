-- H23: Schedule agent-compliance-monitor daily at 7am Eastern = 12pm UTC
-- Requires pg_cron extension (enabled in 20260407000041_pg_cron.sql)

SELECT cron.schedule('compliance-monitor', '0 12 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-compliance-monitor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);
