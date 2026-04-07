-- D4: Enable pg_cron extension for scheduled agents
-- NOTE: pg_cron must be enabled in Supabase Dashboard → Database → Extensions first.
-- This migration sets up all cron schedules once pg_cron is enabled.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── PROACTIVE AGENT SCHEDULES ────────────────────────────────────────────────
-- All times in UTC. Eastern = UTC-5 (winter) or UTC-4 (summer).
-- Using UTC-5 (winter Eastern) as baseline.

-- Morning brief: 6am Eastern = 11am UTC
SELECT cron.schedule('morning-brief', '0 11 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-morning-brief',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Lead aging: 8am Eastern = 1pm UTC
SELECT cron.schedule('lead-aging', '0 13 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-lead-aging',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- At-risk monitor: 7am Eastern = 12pm UTC
SELECT cron.schedule('risk-monitor', '0 12 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-risk-monitor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Sub insurance: 9am Eastern = 2pm UTC
SELECT cron.schedule('sub-insurance-alert', '0 14 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-sub-insurance-alert',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Invoice aging: 8:30am Eastern = 1:30pm UTC
SELECT cron.schedule('invoice-aging', '30 13 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-invoice-aging',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Weekly client update: Friday 4pm Eastern = Friday 9pm UTC
SELECT cron.schedule('weekly-client-update', '0 21 * * 5',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-weekly-client-update',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Weekly financials: Monday 7am Eastern = Monday 12pm UTC
SELECT cron.schedule('weekly-financials', '0 12 * * 1',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-weekly-financials',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Cash flow: Friday 4pm Eastern = Friday 9pm UTC
SELECT cron.schedule('cash-flow', '0 21 * * 5',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-cash-flow',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Social content: Sunday 8am Eastern = Sunday 1pm UTC
SELECT cron.schedule('social-content', '0 13 * * 0',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-social-content',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Warranty tracker: 9am Eastern = 2pm UTC
SELECT cron.schedule('warranty-tracker', '0 14 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-warranty-tracker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Weather alert: 6:30am Eastern = 11:30am UTC
SELECT cron.schedule('weather-schedule', '30 11 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-weather-schedule',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Daily log: 5:30pm Eastern = 10:30pm UTC
SELECT cron.schedule('daily-log', '30 22 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-daily-log',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- ── PHASE E: META AGENT SCHEDULES ────────────────────────────────────────────

-- Meta agent orchestration: Monday 6am Eastern = Monday 11am UTC
SELECT cron.schedule('meta-agent-orchestration', '0 11 * * 1',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/meta-agent-orchestration',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);

-- Improvement analysis: Sunday 10pm Eastern = Monday 3am UTC
SELECT cron.schedule('improvement-analysis', '0 3 * * 1',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-improvement-analysis',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  ) $$
);
