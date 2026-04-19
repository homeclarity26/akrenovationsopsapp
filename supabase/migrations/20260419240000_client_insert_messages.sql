-- Client-portal RLS fix #2 — clients can insert messages on their own project.
--
-- Companion to 20260419230000. Discovered in the same 2026-04-19 deep E2E
-- run: ClientMessages.tsx calls supabase.from('messages').insert() with
-- sender_role='client', but no messages INSERT policy granted clients
-- the write. The two existing INSERT policies are admin-only and
-- employee-only:
--   * "Admin writes messages"     admin_can_project(project_id)
--   * "Employees insert messages" is_employee_or_admin() AND …
-- A client on /client/messages would hit 403 on every send.
--
-- Fix: add a dedicated INSERT policy allowing a client to post a
-- message on a project they're linked to (projects.client_user_id =
-- auth.uid()) provided sender_id = auth.uid() and sender_role = 'client'.

BEGIN;

DROP POLICY IF EXISTS "Clients insert messages" ON public.messages;
CREATE POLICY "Clients insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'client'
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = messages.project_id
        AND p.client_user_id = auth.uid()
    )
  );

COMMIT;
