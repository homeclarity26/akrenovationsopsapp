-- White-label branding columns on companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color_primary TEXT DEFAULT '#1e3a5f';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color_accent TEXT DEFAULT '#c45a3c';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_color_bg TEXT DEFAULT '#faf8f5';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_favicon_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_tagline TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS powered_by_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS powered_by_text TEXT DEFAULT 'Powered by TradeOffice AI';

-- Storage bucket for company logos, favicons, and other assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: everyone can read, admins can upload/delete
CREATE POLICY "company_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "company_assets_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );
