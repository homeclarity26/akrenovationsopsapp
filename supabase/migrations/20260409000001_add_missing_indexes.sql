-- ============================================================================
-- Add missing indexes on frequently-queried columns (Issue C-07)
-- ============================================================================
-- Most base-schema tables have foreign keys but no indexes on the FK columns.
-- This migration adds composite indexes (FK + created_at DESC) for the most
-- common query pattern: "all X for project Y, newest first."
--
-- Tables SKIPPED (already indexed in their own migrations):
--   time_entries   — F2 migration created idx_time_entries_project_id, _user_id
--   sub_scopes     — H1 migration created idx_sub_scopes_project_id
--   checklist_instances — J12: uses polymorphic (entity_type, entity_id), no project_id column
-- ============================================================================

-- ── Project-related lookups (most critical) ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_project_id
  ON invoices(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_project_id
  ON expenses(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON tasks(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_photos_project_id
  ON project_photos(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_logs_project_id
  ON daily_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_project_id
  ON shopping_list_items(project_id);

CREATE INDEX IF NOT EXISTS idx_punch_list_items_project_id
  ON punch_list_items(project_id);

CREATE INDEX IF NOT EXISTS idx_change_orders_project_id
  ON change_orders(project_id);

CREATE INDEX IF NOT EXISTS idx_client_selections_project_id
  ON client_selections(project_id);

CREATE INDEX IF NOT EXISTS idx_schedule_events_project_id
  ON schedule_events(project_id, start_date);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_project_id
  ON warranty_claims(project_id);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id
  ON project_files(project_id);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id
  ON contracts(project_id);

CREATE INDEX IF NOT EXISTS idx_bonus_records_project_id
  ON bonus_records(project_id);

-- ── User-related lookups ───────────────────────────────────────────────────
-- NOTE: time_entries already has idx_time_entries_user_id from F2 migration.
-- The new time_entries uses "user_id" not "employee_id".

CREATE INDEX IF NOT EXISTS idx_bonus_records_employee_id
  ON bonus_records(employee_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_id
  ON messages(recipient_id);

CREATE INDEX IF NOT EXISTS idx_messages_project_id
  ON messages(project_id, created_at DESC);

-- ── Lead lookups ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id
  ON lead_activities(lead_id, created_at DESC);

-- ── Schedule lookups ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_schedule_events_start_date
  ON schedule_events(start_date, end_date);
