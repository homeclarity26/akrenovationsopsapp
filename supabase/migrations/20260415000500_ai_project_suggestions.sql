-- ============================================================================
-- AI Project Suggestions (PR 6 of Live Shared Project State)
-- ============================================================================
-- The meta-agent (and any future AI agent) can propose an action on a project
-- instead of doing it directly. Each suggestion is a row here — the admin
-- reviews in the project page's "Suggestion Inbox", then either Approves
-- (which dispatches the apply-project-suggestion edge function) or Rejects.
--
-- Approved actions mutate the whitelisted project-scoped tables via the
-- edge function using the service role. This table is the durable record
-- of every suggestion, its outcome, and the reviewer.
--
-- Integrates with PR 3's project_activity: a row here fires an
-- 'ai_suggestion' activity on create and an 'ai_action' activity on apply.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_project_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Free text — e.g. 'create_task', 'update_status', 'add_shopping_item',
  -- 'draft_daily_log'. Kept as TEXT so the AI can coin new types without
  -- migrations.
  suggestion_type TEXT NOT NULL,
  -- One-line human-readable summary (the card title in the inbox).
  summary TEXT NOT NULL,
  -- Longer "why" the AI thinks this is a good idea.
  rationale TEXT,
  -- Machine-readable payload the apply function executes. Two shapes:
  --   { "table": "tasks", "operation": "insert", "values": { ... } }
  --   { "table": "projects", "operation": "update", "id": "...", "patch": {...} }
  proposed_action JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'failed', 'expired')),
  -- Which agent proposed it (attribution). Defaults to 'meta-agent'.
  source TEXT NOT NULL DEFAULT 'meta-agent',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  -- Filled with the thrown error when status = 'failed', or the admin's
  -- reason when status = 'rejected'.
  error_message TEXT,
  -- Optional; suggestions can auto-expire after N days.
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary index: list by project, newest first.
CREATE INDEX IF NOT EXISTS ai_project_suggestions_project_status_created_idx
  ON ai_project_suggestions(project_id, status, created_at DESC);

-- Hot path: the Suggestion Inbox only queries pending ones.
CREATE INDEX IF NOT EXISTS ai_project_suggestions_pending_partial_idx
  ON ai_project_suggestions(project_id)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT mirrors the project: can_access_project(project_id).
-- INSERT is admin-only. The AI normally inserts via a service-role edge
-- function (which bypasses RLS entirely), but giving admins INSERT lets
-- manual testing work without a function.
-- UPDATE/DELETE are admin-only — this is the gate for approve/reject.

ALTER TABLE ai_project_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suggestion read" ON ai_project_suggestions;
CREATE POLICY "Suggestion read" ON ai_project_suggestions
  FOR SELECT TO authenticated
  USING (can_access_project(project_id));

DROP POLICY IF EXISTS "Suggestion admin insert" ON ai_project_suggestions;
CREATE POLICY "Suggestion admin insert" ON ai_project_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Suggestion admin update" ON ai_project_suggestions;
CREATE POLICY "Suggestion admin update" ON ai_project_suggestions
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Suggestion admin delete" ON ai_project_suggestions;
CREATE POLICY "Suggestion admin delete" ON ai_project_suggestions
  FOR DELETE TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Realtime publication
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_project_suggestions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_project_suggestions;
  END IF;

  EXECUTE 'ALTER TABLE ai_project_suggestions REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ai_project_suggestions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_project_suggestions_updated_at ON ai_project_suggestions;
CREATE TRIGGER trg_ai_project_suggestions_updated_at
  BEFORE UPDATE ON ai_project_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION ai_project_suggestions_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Activity trigger — write into project_activity on create / apply / fail
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the function can INSERT into project_activity regardless
-- of caller (including service-role edge functions where auth.uid() is NULL).
--
-- Emits:
--   • 'ai_suggestion' on INSERT — actor_type = 'ai'
--   • 'ai_action' when status transitions to 'applied' — actor_type = 'user'
--     (the reviewing admin)
--   • 'ai_action' when status transitions to 'failed' — actor_type = 'system'
--   • 'ai_suggestion' when status transitions to 'rejected' — actor_type = 'user'

CREATE OR REPLACE FUNCTION log_ai_suggestion_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_type TEXT;
  v_activity_type TEXT;
  v_summary TEXT;
  v_metadata JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor_id := NULL;
    v_actor_type := 'ai';
    v_activity_type := 'ai_suggestion';
    v_summary := 'Proposed: ' || LEFT(NEW.summary, 120);
    v_metadata := jsonb_build_object(
      'suggestion_id', NEW.id,
      'suggestion_type', NEW.suggestion_type,
      'source', NEW.source
    );

    INSERT INTO project_activity (
      project_id, actor_id, actor_type, activity_type,
      entity_table, entity_id, summary, metadata
    ) VALUES (
      NEW.project_id, v_actor_id, v_actor_type, v_activity_type,
      'ai_project_suggestions', NEW.id, v_summary, v_metadata
    );

    RETURN NEW;
  END IF;

  -- UPDATE branch — only interested in status transitions.
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'applied' THEN
      v_actor_id := NEW.reviewed_by;
      v_actor_type := 'user';
      v_activity_type := 'ai_action';
      v_summary := 'Applied AI suggestion: ' || LEFT(NEW.summary, 100);
    ELSIF NEW.status = 'failed' THEN
      v_actor_id := NEW.reviewed_by;
      v_actor_type := 'system';
      v_activity_type := 'ai_action';
      v_summary := 'AI suggestion failed: ' || LEFT(NEW.summary, 90);
    ELSIF NEW.status = 'rejected' THEN
      v_actor_id := NEW.reviewed_by;
      v_actor_type := 'user';
      v_activity_type := 'ai_suggestion';
      v_summary := 'Rejected AI suggestion: ' || LEFT(NEW.summary, 90);
    ELSE
      RETURN NEW;
    END IF;

    v_metadata := jsonb_build_object(
      'suggestion_id', NEW.id,
      'suggestion_type', NEW.suggestion_type,
      'source', NEW.source,
      'from_status', OLD.status,
      'to_status', NEW.status,
      'error_message', NEW.error_message
    );

    INSERT INTO project_activity (
      project_id, actor_id, actor_type, activity_type,
      entity_table, entity_id, summary, metadata
    ) VALUES (
      NEW.project_id, v_actor_id, v_actor_type, v_activity_type,
      'ai_project_suggestions', NEW.id, v_summary, v_metadata
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_project_suggestions_activity ON ai_project_suggestions;
CREATE TRIGGER trg_ai_project_suggestions_activity
  AFTER INSERT OR UPDATE ON ai_project_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION log_ai_suggestion_activity();
