-- ============================================================================
-- Add ON DELETE CASCADE to project_id foreign keys (Issue C-09)
-- ============================================================================
-- Deleting a project currently orphans records in 15+ child tables because
-- the foreign keys were created without ON DELETE CASCADE. This migration
-- drops each FK constraint and re-adds it with CASCADE.
--
-- Tables SKIPPED (already have CASCADE in their CREATE TABLE):
--   project_phases      — base schema line 125
--   project_assignments — base schema line 137
--
-- Constraint naming: Supabase/PostgreSQL auto-generates FK constraint names
-- as {table}_{column}_fkey when declared inline with REFERENCES. We use
-- a dynamic DO block to look up actual constraint names from the catalog
-- to avoid guessing.
-- ============================================================================

-- Helper function: drop a FK constraint by table + column, regardless of name
CREATE OR REPLACE FUNCTION pg_temp.drop_fk_if_exists(
  p_table TEXT,
  p_column TEXT
) RETURNS VOID AS $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid
                      AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = p_table::regclass
    AND c.contype = 'f'
    AND a.attname = p_column
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, v_constraint_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── Base-schema tables: project_id → projects(id) ON DELETE CASCADE ────────

-- invoices
SELECT pg_temp.drop_fk_if_exists('invoices', 'project_id');
ALTER TABLE invoices
  ADD CONSTRAINT invoices_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- expenses
SELECT pg_temp.drop_fk_if_exists('expenses', 'project_id');
ALTER TABLE expenses
  ADD CONSTRAINT expenses_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- tasks
SELECT pg_temp.drop_fk_if_exists('tasks', 'project_id');
ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- project_photos
SELECT pg_temp.drop_fk_if_exists('project_photos', 'project_id');
ALTER TABLE project_photos
  ADD CONSTRAINT project_photos_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- daily_logs
SELECT pg_temp.drop_fk_if_exists('daily_logs', 'project_id');
ALTER TABLE daily_logs
  ADD CONSTRAINT daily_logs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- shopping_list_items
SELECT pg_temp.drop_fk_if_exists('shopping_list_items', 'project_id');
ALTER TABLE shopping_list_items
  ADD CONSTRAINT shopping_list_items_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- punch_list_items
SELECT pg_temp.drop_fk_if_exists('punch_list_items', 'project_id');
ALTER TABLE punch_list_items
  ADD CONSTRAINT punch_list_items_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- change_orders
SELECT pg_temp.drop_fk_if_exists('change_orders', 'project_id');
ALTER TABLE change_orders
  ADD CONSTRAINT change_orders_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- client_selections
SELECT pg_temp.drop_fk_if_exists('client_selections', 'project_id');
ALTER TABLE client_selections
  ADD CONSTRAINT client_selections_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- schedule_events
SELECT pg_temp.drop_fk_if_exists('schedule_events', 'project_id');
ALTER TABLE schedule_events
  ADD CONSTRAINT schedule_events_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- warranty_claims
SELECT pg_temp.drop_fk_if_exists('warranty_claims', 'project_id');
ALTER TABLE warranty_claims
  ADD CONSTRAINT warranty_claims_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- project_files
SELECT pg_temp.drop_fk_if_exists('project_files', 'project_id');
ALTER TABLE project_files
  ADD CONSTRAINT project_files_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- contracts
SELECT pg_temp.drop_fk_if_exists('contracts', 'project_id');
ALTER TABLE contracts
  ADD CONSTRAINT contracts_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- bonus_records
SELECT pg_temp.drop_fk_if_exists('bonus_records', 'project_id');
ALTER TABLE bonus_records
  ADD CONSTRAINT bonus_records_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- messages
SELECT pg_temp.drop_fk_if_exists('messages', 'project_id');
ALTER TABLE messages
  ADD CONSTRAINT messages_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- purchase_orders
SELECT pg_temp.drop_fk_if_exists('purchase_orders', 'project_id');
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- project_subcontractors
SELECT pg_temp.drop_fk_if_exists('project_subcontractors', 'project_id');
ALTER TABLE project_subcontractors
  ADD CONSTRAINT project_subcontractors_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ── Later-migration tables ─────────────────────────────────────────────────

-- time_entries (new F2 table — project_id is nullable, CASCADE still correct)
SELECT pg_temp.drop_fk_if_exists('time_entries', 'project_id');
ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- sub_scopes (H1 migration — already has CASCADE, but re-apply idempotently)
SELECT pg_temp.drop_fk_if_exists('sub_scopes', 'project_id');
ALTER TABLE sub_scopes
  ADD CONSTRAINT sub_scopes_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ai_conversations
SELECT pg_temp.drop_fk_if_exists('ai_conversations', 'project_id');
ALTER TABLE ai_conversations
  ADD CONSTRAINT ai_conversations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- client_progress_updates
SELECT pg_temp.drop_fk_if_exists('client_progress_updates', 'project_id');
ALTER TABLE client_progress_updates
  ADD CONSTRAINT client_progress_updates_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- communication_log
SELECT pg_temp.drop_fk_if_exists('communication_log', 'project_id');
ALTER TABLE communication_log
  ADD CONSTRAINT communication_log_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- satisfaction_surveys
SELECT pg_temp.drop_fk_if_exists('satisfaction_surveys', 'project_id');
ALTER TABLE satisfaction_surveys
  ADD CONSTRAINT satisfaction_surveys_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- review_requests
SELECT pg_temp.drop_fk_if_exists('review_requests', 'project_id');
ALTER TABLE review_requests
  ADD CONSTRAINT review_requests_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- permits
SELECT pg_temp.drop_fk_if_exists('permits', 'project_id');
ALTER TABLE permits
  ADD CONSTRAINT permits_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- proposals (project_id is nullable)
SELECT pg_temp.drop_fk_if_exists('proposals', 'project_id');
ALTER TABLE proposals
  ADD CONSTRAINT proposals_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Drop the temporary helper function
DROP FUNCTION IF EXISTS pg_temp.drop_fk_if_exists(TEXT, TEXT);
