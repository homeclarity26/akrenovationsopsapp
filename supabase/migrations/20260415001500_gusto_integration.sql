-- Gusto integration: integrations table + gusto_synced_at on payroll_records
-- Uses IF NOT EXISTS / IF NOT EXISTS so it's safe if PR 23 also creates
-- the integrations table on a parallel branch.

-- ── integrations table (same shape PR 23 uses) ─────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('quickbooks', 'gusto', 'stripe', 'twilio')),
  access_token  TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  realm_id      TEXT,
  metadata      JSONB DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policy: admins of the company can read their own integrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'integrations_admin_read'
  ) THEN
    EXECUTE 'CREATE POLICY integrations_admin_read ON integrations FOR SELECT USING (
      company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN (''admin'', ''super_admin'')
      )
    )';
  END IF;
END $$;

-- Policy: service role can do everything (edge functions use service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'integrations_service_all'
  ) THEN
    EXECUTE 'CREATE POLICY integrations_service_all ON integrations FOR ALL USING (
      auth.role() = ''service_role''
    )';
  END IF;
END $$;

-- ── Add gusto_synced_at to payroll_records ──────────────────────────
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS gusto_synced_at TIMESTAMPTZ;

-- ── Add gusto_payroll_id to payroll_records (per-record Gusto ref) ──
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS gusto_payroll_id TEXT;
