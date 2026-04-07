-- C2: Add pdf_url to daily_logs (not in original schema)

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS pdf_url TEXT;
