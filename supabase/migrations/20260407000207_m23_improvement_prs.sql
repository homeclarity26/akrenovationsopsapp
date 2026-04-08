-- M23: improvement_prs — track GitHub PRs opened by the meta agent

CREATE TABLE IF NOT EXISTS improvement_prs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  improvement_spec_id UUID NOT NULL REFERENCES improvement_specs(id) ON DELETE CASCADE,
  pr_number INTEGER,
  pr_url TEXT,
  pr_title TEXT NOT NULL,
  pr_body TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  files_changed JSONB NOT NULL,
  change_category TEXT NOT NULL CHECK (change_category IN (
    'data_insert',
    'data_update',
    'copy_change',
    'claude_code'
  )),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pr_opened',
    'approved',
    'merged',
    'deployed',
    'closed',
    'failed'
  )),
  github_sha TEXT,
  deployed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_improvement_prs_spec    ON improvement_prs (improvement_spec_id);
CREATE INDEX IF NOT EXISTS idx_improvement_prs_status  ON improvement_prs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_improvement_prs_pr_num  ON improvement_prs (pr_number);

ALTER TABLE improvement_prs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to improvement_prs" ON improvement_prs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_improvement_prs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS improvement_prs_updated_at ON improvement_prs;
CREATE TRIGGER improvement_prs_updated_at
  BEFORE UPDATE ON improvement_prs
  FOR EACH ROW EXECUTE FUNCTION update_improvement_prs_updated_at();
