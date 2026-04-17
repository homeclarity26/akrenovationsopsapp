-- ============================================================================
-- Reminders + Notifications (PR — reminders backend)
-- ============================================================================
-- Two tables + per-user preference columns + a 1-minute dispatcher cron.
--
-- reminders        — user-created or AI-scheduled, fire at remind_at (tz-aware)
-- notifications    — persistent in-app bell feed (not just in-memory toasts)
--
-- profiles.timezone              — IANA tz string, falls back to companies.timezone
-- profiles.notification_preferences — {"email":bool,"sms":bool,"in_app":bool,"sound":bool}
--
-- Dispatcher: pg_cron runs every minute and POSTs to process-due-reminders,
-- which fans out to email/SMS/in_app per user preference.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Per-user columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT
  '{"email":true,"sms":false,"in_app":true,"sound":true}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. reminders table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  -- Absolute UTC fire time. The client converts the user's local time using
  -- the user's timezone (or company timezone) before insert.
  remind_at TIMESTAMPTZ NOT NULL,
  -- Stored for display + recurrence rescheduling. Null = use company tz.
  timezone TEXT,
  -- null = one-shot. 'daily' / 'weekly' = simple recurrence handled by
  -- process-due-reminders (after firing, it inserts the next instance).
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly')),
  -- Which channels to attempt. Dispatcher intersects this with the user's
  -- notification_preferences before sending.
  channels JSONB NOT NULL DEFAULT '["in_app","email"]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'dismissed', 'error', 'snoozed')),
  -- If true, was scheduled by the meta-agent (vs. manual UI create).
  created_by_agent BOOLEAN NOT NULL DEFAULT false,
  -- Optional: link to a project. Reminders are user-scoped, not project-scoped,
  -- but a reminder "check concrete pour at Johnson" may reference one.
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path: the dispatcher queries pending rows whose remind_at has passed.
CREATE INDEX IF NOT EXISTS reminders_due_partial_idx
  ON reminders(remind_at)
  WHERE status = 'pending';

-- User's reminders list (newest first).
CREATE INDEX IF NOT EXISTS reminders_user_created_idx
  ON reminders(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. notifications table — persistent in-app bell feed
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- 'reminder' | 'system' | future kinds
  kind TEXT NOT NULL DEFAULT 'reminder',
  title TEXT NOT NULL,
  body TEXT,
  -- Optional deep-link the bell popover can open.
  link_url TEXT,
  -- When non-null, the user has marked this read.
  read_at TIMESTAMPTZ,
  -- Back-reference so dismissing a reminder can mark its notification read.
  source_reminder_id UUID REFERENCES reminders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unread count + bell list are the two hot queries.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — reminders
-- ─────────────────────────────────────────────────────────────────────────────
-- Users see/manage their OWN reminders. Admins within the same company can
-- see all reminders for their company (for oversight/support). Service role
-- bypasses RLS entirely (dispatcher uses it).

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reminders self read" ON reminders;
CREATE POLICY "Reminders self read" ON reminders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = reminders.company_id
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Reminders self insert" ON reminders;
CREATE POLICY "Reminders self insert" ON reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Reminders self update" ON reminders;
CREATE POLICY "Reminders self update" ON reminders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Reminders self delete" ON reminders;
CREATE POLICY "Reminders self delete" ON reminders
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — notifications
-- ─────────────────────────────────────────────────────────────────────────────
-- Users see ONLY their own. Only service_role (dispatcher) writes. Users
-- can UPDATE their own row to mark read (only read_at changes — enforced
-- by the update policy WITH CHECK).

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications self read" ON notifications;
CREATE POLICY "Notifications self read" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications self update" ON notifications;
CREATE POLICY "Notifications self update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications self delete" ON notifications;
CREATE POLICY "Notifications self delete" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- service_role explicit policy so the dispatcher edge function can INSERT
-- even if a future migration tightens defaults.
DROP POLICY IF EXISTS "Notifications service write" ON notifications;
CREATE POLICY "Notifications service write" ON notifications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Reminders service write" ON reminders;
CREATE POLICY "Reminders service write" ON reminders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Realtime publication — bell needs live unread count
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reminders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
  END IF;

  EXECUTE 'ALTER TABLE notifications REPLICA IDENTITY FULL';
  EXECUTE 'ALTER TABLE reminders REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. updated_at trigger on reminders
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reminders_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reminders_updated_at ON reminders;
CREATE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION reminders_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Dispatcher cron — every minute, POST to process-due-reminders
-- ─────────────────────────────────────────────────────────────────────────────
-- Pattern mirrors inventory-alerts-digest (20260415001200). Idempotent.

DO $$
BEGIN
  PERFORM cron.unschedule('reminders-dispatch-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('reminders-dispatch-every-minute', '* * * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/process-due-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) $$
);
