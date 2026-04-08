-- M1: backup_logs — track every backup run

CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN (
    'daily_sql',
    'daily_json',
    'storage_manifest',
    'storage_full',
    'schema_snapshot'
  )),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  file_name TEXT,
  file_size_bytes BIGINT,
  drive_url TEXT,
  drive_file_id TEXT,
  records_exported INTEGER,
  error_message TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_started_at ON backup_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs (status, started_at DESC);

ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to backup_logs" ON backup_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
