-- ============================================================================
-- Photo-based stocktake (PR 12 of Live Shared Project State / Multi-Location
-- Inventory)
-- ============================================================================
-- Adds a private storage bucket 'stocktake-photos' plus two new columns on
-- inventory_stocktakes so the photo flow has a place to hang its artifacts:
--
--   photo_url  — nullable; the photo that was used to propose this count
--   source     — how the count was entered: 'manual' | 'photo_ai' | 'bulk_import'
--
-- The actual AI proposal + review UX lives in the new agent-photo-stocktake
-- edge function + EmployeeStocktakePage's new "Scan" modal. No existing RLS
-- changes — inventory_stocktakes policies still cover the new columns
-- unchanged (counted_by = auth.uid()).
--
-- Storage RLS (storage.objects):
--   - employees INSERT only into their own company+user folder
--   - employees SELECT only their own uploads
--   - admins SELECT / DELETE anything in the bucket
--
-- Path convention enforced by the frontend:
--   stocktake-photos/{company_id}/{user_id}/{yyyy-mm-dd}/{uuid}.jpg
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bucket
-- ─────────────────────────────────────────────────────────────────────────────
-- Private bucket; uploads go through the authenticated supabase-js client.

INSERT INTO storage.buckets (id, name, public)
VALUES ('stocktake-photos', 'stocktake-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage policies
-- ─────────────────────────────────────────────────────────────────────────────
-- storage.objects has one row per uploaded file. We gate via the `name`
-- (object path) and `bucket_id` columns. Folders are just the first
-- path segments (split on `/`).

-- Path layout the frontend must use:
--   {company_id}/{user_id}/{yyyy-mm-dd}/{uuid}.jpg
-- (foldername(name))[1] = company_id
-- (foldername(name))[2] = user_id

-- 2a. Employees can INSERT (upload) only into /{their_company}/{their_user}/…
DROP POLICY IF EXISTS "Employees upload stocktake photos" ON storage.objects;
CREATE POLICY "Employees upload stocktake photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'stocktake-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 2b. Employees can SELECT only their own uploads
DROP POLICY IF EXISTS "Employees read own stocktake photos" ON storage.objects;
CREATE POLICY "Employees read own stocktake photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'stocktake-photos'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 2c. Admins can SELECT anything in the bucket (for review + lightbox)
DROP POLICY IF EXISTS "Admins read any stocktake photo" ON storage.objects;
CREATE POLICY "Admins read any stocktake photo" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'stocktake-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2d. Admins can DELETE stocktake photos (cleanup / privacy on request)
DROP POLICY IF EXISTS "Admins delete stocktake photos" ON storage.objects;
CREATE POLICY "Admins delete stocktake photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'stocktake-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Columns on inventory_stocktakes
-- ─────────────────────────────────────────────────────────────────────────────
-- photo_url: full URL (signed or storage-path key). Nullable because legacy
-- manual counts and bulk-imports don't have a photo.
-- source: distinguishes manual entry, photo-AI-assisted entry, and future
-- bulk-import runs. Default 'manual' keeps existing writes working unchanged.

ALTER TABLE inventory_stocktakes
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE inventory_stocktakes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'photo_ai', 'bulk_import'));

-- Thin index so the "has-photo" lookup in Phase 2 (last-counted thumbnail) is
-- cheap. Filtered to the photo-only rows — keeps the index tiny even as the
-- stocktakes log grows.
CREATE INDEX IF NOT EXISTS inventory_stocktakes_photo_idx
  ON inventory_stocktakes(item_id, location_id, created_at DESC)
  WHERE photo_url IS NOT NULL;
