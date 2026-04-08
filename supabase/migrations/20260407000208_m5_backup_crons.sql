-- M5: pg_cron schedules for backup system
-- Daily backup: 2am Eastern (7am UTC)
-- Weekly storage manifest: Sunday 3am Eastern (8am UTC)
-- Daily rate limit cleanup: 3am UTC
-- Daily session cleanup: 3:30am UTC

SELECT cron.schedule(
  'daily-backup',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/backup-daily',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'weekly-storage-manifest',
  '0 8 * * 0',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/backup-storage-manifest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Rate limit table cleanup: 3am UTC daily
SELECT cron.schedule(
  'rate-limit-cleanup',
  '0 3 * * *',
  $$ SELECT cleanup_old_rate_limit_events() $$
);

-- Expired session cleanup: 3:30am UTC daily
SELECT cron.schedule(
  'session-cleanup',
  '30 3 * * *',
  $$ SELECT cleanup_expired_sessions() $$
);
