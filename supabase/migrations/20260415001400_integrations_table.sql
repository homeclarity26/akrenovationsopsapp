-- PR 23: Integrations table for QuickBooks Online (and future Gusto/Stripe/Twilio)

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('quickbooks', 'gusto', 'stripe', 'twilio')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  realm_id TEXT,  -- QBO-specific: the company realm ID
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS integrations_company_provider_uniq
  ON integrations(company_id, provider);

-- RLS: admin-only CRUD
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrations_admin_select ON integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = integrations.company_id
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY integrations_admin_insert ON integrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = integrations.company_id
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY integrations_admin_update ON integrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = integrations.company_id
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY integrations_admin_delete ON integrations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = integrations.company_id
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- updated_at trigger (reuse existing pattern)
CREATE OR REPLACE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE integrations;

-- Daily QBO sync at 6am Eastern (11:00 UTC)
SELECT cron.schedule(
  'quickbooks-daily-sync',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-quickbooks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);
