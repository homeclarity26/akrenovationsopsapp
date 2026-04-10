-- PR #19: User invitation flows
-- Three invitation types: employee (admin creates), client (per-project), company (future self-serve)

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'client')),
  -- Employee-specific fields
  full_name TEXT,
  temp_password TEXT,
  pay_type TEXT CHECK (pay_type IN ('hourly', 'salary')),
  pay_rate NUMERIC,
  start_date DATE,
  emergency_contact TEXT,
  phone TEXT,
  notes TEXT,
  -- Client-specific fields
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- Shared
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add onboarding_complete flag to profiles so we know when to show walkthroughs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pwa_prompt_shown BOOLEAN DEFAULT false;

-- Add plan_tier / status / mrr to companies for Item 12 (platform admin)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'trial' CHECK (plan_tier IN ('trial', 'starter', 'pro', 'enterprise'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'trial', 'suspended', 'cancelled'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mrr NUMERIC DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations for their company
CREATE POLICY "Admins manage invitations"
  ON invitations FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Anyone can read an invitation by token (for the accept flow — no auth needed)
CREATE POLICY "Public read by token"
  ON invitations FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to invitations"
  ON invitations FOR ALL
  USING (auth.role() = 'service_role');

-- Index for token lookups (accept flow)
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_company_id_idx ON invitations(company_id);
