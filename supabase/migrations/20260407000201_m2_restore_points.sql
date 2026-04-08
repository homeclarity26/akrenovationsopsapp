-- M2: restore_points — manually-created checkpoints before risky operations

CREATE TABLE IF NOT EXISTS restore_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  backup_log_id UUID REFERENCES backup_logs(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restore_points_created_at ON restore_points (created_at DESC);

ALTER TABLE restore_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to restore_points" ON restore_points
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
