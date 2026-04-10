-- Platform Admin: add super_admin role, platform tables, and RLS policies
-- This enables a platform-level admin who can see all companies and users.

-- 1. Widen the role CHECK constraint on profiles to include 'super_admin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employee', 'client', 'super_admin'));

-- 2. Platform-level settings (key-value store)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin full access to platform_settings"
  ON platform_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

CREATE POLICY "service role full access to platform_settings"
  ON platform_settings FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Platform audit log
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT, -- 'company', 'user', 'setting'
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin full access to platform_audit_log"
  ON platform_audit_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

CREATE POLICY "service role full access to platform_audit_log"
  ON platform_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Super-admin can read ALL companies (override the company-scoped policy)
CREATE POLICY "super_admin can read all companies"
  ON companies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- 5. Super-admin can read ALL profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND schemaname = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'super_admin can read all profiles'
    ) THEN
      EXECUTE 'CREATE POLICY "super_admin can read all profiles" ON profiles FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ''super_admin''))';
    END IF;
  END IF;
END $$;
