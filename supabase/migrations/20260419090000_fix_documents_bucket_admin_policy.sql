-- Fix: the documents bucket INSERT policy was written on the assumption that
-- the first path segment is always a project_id. That's true for generate-pdf
-- (documents/{project_id}/...), but the new ShareMenu uploads under the
-- document id itself (documents/{doc_id}/{ts}-{name} where doc_id is the
-- proposal/invoice/contract id). So "Copy shareable link" on a proposal
-- returned "new row violates row-level security policy".
--
-- Fix: admin (or super_admin) can write ANY path inside the documents
-- bucket. Non-admin writes still have to live under a project they're
-- assigned to. Reads stay scoped as before (admin via admin_can_project +
-- employee via project_assignments).

DROP POLICY IF EXISTS "documents_admin_write" ON storage.objects;
CREATE POLICY "documents_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      is_admin()
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND admin_can_project(((storage.foldername(name))[1])::uuid)
      )
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      is_admin()
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND admin_can_project(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- Also allow admins to read any doc in the bucket — the existing SELECT
-- policy ties to admin_can_project(first segment), same issue as the write.
DROP POLICY IF EXISTS "documents_project_read" ON storage.objects;
CREATE POLICY "documents_project_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      is_admin()
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND (
          admin_can_project(((storage.foldername(name))[1])::uuid)
          OR EXISTS (
            SELECT 1 FROM project_assignments pa
            WHERE pa.project_id::text = (storage.foldername(name))[1]
              AND pa.employee_id = auth.uid()
          )
        )
      )
    )
  );
