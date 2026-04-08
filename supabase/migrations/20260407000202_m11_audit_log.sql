-- M11: audit_log — every significant data change recorded for forensics

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  user_role TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'create',
    'update',
    'delete',
    'view_sensitive',
    'export',
    'login',
    'logout',
    'login_failed',
    'permission_denied',
    'api_call'
  )),
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for the queries the security dashboard makes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id   ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_rec ON audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action    ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON audit_log (created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access. Audit log is sacred — never expose to other roles.
CREATE POLICY "Admin full access to audit_log" ON audit_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Allow ANY authenticated user to insert their own audit events from the
-- client-side audit utility (logAuditEvent in src/lib/audit.ts). The trigger
-- function below always runs as security-definer so it can also insert.
CREATE POLICY "Authenticated users can insert their own audit_log" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
