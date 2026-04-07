-- K56: Add reel columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reel_pdf_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reel_gallery_token TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reel_generated_at TIMESTAMPTZ;
