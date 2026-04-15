-- ============================================================================
-- Inventory Alerts (PR 11 — AI inventory agent + low-stock scan)
-- ============================================================================
-- Adds inventory_alerts table fed by the agent-inventory-alerts edge function.
-- Alerts are company-scoped (not project-scoped) and deduplicated per
-- (item_id, alert_type) while status='open' so repeated daily scans don't
-- spam the inbox.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. inventory_alerts — open/acknowledged/resolved/dismissed alerts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'stale_count')),
  current_total NUMERIC NOT NULL,
  threshold NUMERIC,
  summary TEXT NOT NULL,
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_alerts_company_status_created_idx
  ON inventory_alerts(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_alerts_item_type_open_idx
  ON inventory_alerts(item_id, alert_type) WHERE status = 'open';

-- Dedup guard: at most one open alert per (item, type).
CREATE UNIQUE INDEX IF NOT EXISTS inventory_alerts_open_unique
  ON inventory_alerts(item_id, alert_type) WHERE status = 'open';

-- updated_at trigger — reuses inventory_set_updated_at() from PR 7.
DROP TRIGGER IF EXISTS trg_inventory_alerts_updated_at ON inventory_alerts;
CREATE TRIGGER trg_inventory_alerts_updated_at
  BEFORE UPDATE ON inventory_alerts
  FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access inventory_alerts" ON inventory_alerts;
CREATE POLICY "Admin full access inventory_alerts" ON inventory_alerts
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Employees read inventory_alerts" ON inventory_alerts;
CREATE POLICY "Employees read inventory_alerts" ON inventory_alerts
  FOR SELECT TO authenticated
  USING (
    is_employee_or_admin()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Realtime publication
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
      AND tablename = 'inventory_alerts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE inventory_alerts';
  END IF;

  EXECUTE 'ALTER TABLE inventory_alerts REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Cron — daily scan at 8:22 Eastern = 13:22 UTC
-- ─────────────────────────────────────────────────────────────────────────────
-- Off the :00/:30 marks used by existing crons to spread load.

DO $$
BEGIN
  PERFORM cron.unschedule('inventory-alerts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('inventory-alerts', '22 13 * * *',
  $$ SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-inventory-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) $$
);
