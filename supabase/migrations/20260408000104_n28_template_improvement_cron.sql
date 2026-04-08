-- N28: Schedule agent-template-improvement-suggester via pg_cron
-- Runs Sunday night at 11pm ET (4am UTC Monday)

SELECT cron.schedule(
  'template-improvement-suggester-weekly',
  '0 4 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/agent-template-improvement-suggester',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
