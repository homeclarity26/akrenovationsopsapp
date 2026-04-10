-- Multi-tenant: add companies table and link profiles to companies
-- This enables the app to serve multiple customers beyond AK Renovations.

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT DEFAULT 'remodeling',
  city TEXT,
  state TEXT,
  owner_name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add company_id to profiles so each user belongs to a company
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- RLS: users can read their own company
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company"
  ON companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Service role full access to companies"
  ON companies FOR ALL
  USING (auth.role() = 'service_role');
