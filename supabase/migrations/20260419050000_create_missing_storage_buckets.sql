-- Fix: four storage buckets that the app actively uploads to were never
-- created, and had no RLS policies. Every photo-upload and receipt-scan
-- flow hung on a CORS preflight because the bucket literally doesn't
-- exist. The HealthPage even claimed these buckets existed ("Buckets:
-- project-photos, receipts, documents, project-files") — that was
-- aspirational, not real.
--
-- Buckets to create:
--   - project-photos    (employee photos, admin project photos — public read)
--   - receipts          (receipt scans — private, scoped to uploader/admin)
--   - documents         (scope docs, signed contracts — private, per-project)
--   - project-files     (misc project files — private, per-project)
--
-- Upload paths the client code uses (path-is-authority convention):
--   project-photos :  {project_id}/{timestamp}.{ext}
--   receipts       :  {user_id}/{timestamp}.{ext}
--   documents      :  {project_id}/{timestamp}-{name}
--   project-files  :  {project_id}/{timestamp}-{name}
--
-- Policies mirror the existing stocktake-photos pattern: authenticated
-- users insert into their own scope, admins read/modify anything in their
-- company's projects.

-- ── Buckets ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── project-photos policies ─────────────────────────────────────────────
-- Public bucket: anyone can SELECT (for image <img> tags to render).
DROP POLICY IF EXISTS "project_photos_public_read" ON storage.objects;
CREATE POLICY "project_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'project-photos');

-- Authenticated users can upload; path's first segment is project_id,
-- so scope via admin_can_project(uuid) OR assigned-to-project check.
DROP POLICY IF EXISTS "project_photos_authenticated_insert" ON storage.objects;
CREATE POLICY "project_photos_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-photos'
    AND (
      -- admin can upload to any project in their company
      (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND admin_can_project(((storage.foldername(name))[1])::uuid)
      )
      -- OR the user is assigned to the project
      OR EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id::text = (storage.foldername(name))[1]
          AND pa.employee_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "project_photos_admin_modify" ON storage.objects;
CREATE POLICY "project_photos_admin_modify" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND admin_can_project(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "project_photos_admin_delete" ON storage.objects;
CREATE POLICY "project_photos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND admin_can_project(((storage.foldername(name))[1])::uuid)
  );

-- ── receipts policies ───────────────────────────────────────────────────
-- Private: only the uploader (path's first segment = user id) and admins.
DROP POLICY IF EXISTS "receipts_owner_read" ON storage.objects;
CREATE POLICY "receipts_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

DROP POLICY IF EXISTS "receipts_owner_insert" ON storage.objects;
CREATE POLICY "receipts_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "receipts_admin_delete" ON storage.objects;
CREATE POLICY "receipts_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- ── documents policies ──────────────────────────────────────────────────
-- Private, scoped by project_id in first folder.
DROP POLICY IF EXISTS "documents_project_read" ON storage.objects;
CREATE POLICY "documents_project_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      admin_can_project(((storage.foldername(name))[1])::uuid)
      OR EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id::text = (storage.foldername(name))[1]
          AND pa.employee_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "documents_admin_write" ON storage.objects;
CREATE POLICY "documents_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND admin_can_project(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND admin_can_project(((storage.foldername(name))[1])::uuid)
  );

-- ── project-files policies (same shape as documents) ────────────────────
DROP POLICY IF EXISTS "project_files_project_read" ON storage.objects;
CREATE POLICY "project_files_project_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND (
      admin_can_project(((storage.foldername(name))[1])::uuid)
      OR EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id::text = (storage.foldername(name))[1]
          AND pa.employee_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "project_files_admin_write" ON storage.objects;
CREATE POLICY "project_files_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND admin_can_project(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'project-files'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    AND admin_can_project(((storage.foldername(name))[1])::uuid)
  );
