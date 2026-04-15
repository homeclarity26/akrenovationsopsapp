-- ============================================================================
-- Project Activity Feed (PR 3 of Live Shared Project State)
-- ============================================================================
-- A chronological, immutable log of every meaningful change on a project —
-- who did what, when, to which row. Powers:
--   • The "Activity" tab on the admin project page (and, in PR 5, the
--     employee project detail page).
--   • The upcoming AI participant work in PR 6 (the meta-agent writes its
--     own rows with actor_type = 'ai').
--
-- Everything is populated via AFTER INSERT/UPDATE/DELETE triggers on the
-- project-scoped tables. No UI code has to remember to write an activity
-- row; the server is the source of truth.
--
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- actor_id is NULL for AI and system events. For user events it's the
  -- profile id of the person who triggered it (auth.uid() at trigger time).
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'ai', 'system')),
  -- Broad categorization. Kept as TEXT (not enum) so PR 6 can add new
  -- AI-specific types without a migration.
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'created', 'updated', 'deleted',
      'status_changed', 'assigned', 'unassigned',
      'commented', 'flagged', 'completed',
      'ai_suggestion', 'ai_action'
    )),
  -- Which table and row the activity is about. entity_id may be NULL for
  -- project-level events (e.g. the project itself was renamed).
  entity_table TEXT NOT NULL,
  entity_id UUID,
  -- One-line human summary. The UI can always use this as-is; metadata is
  -- for richer rendering (before/after diffs, cost deltas, etc.).
  summary TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_activity_project_created_idx
  ON project_activity(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_activity_entity_idx
  ON project_activity(entity_table, entity_id);

CREATE INDEX IF NOT EXISTS project_activity_actor_idx
  ON project_activity(actor_id) WHERE actor_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT mirrors the project: can_access_project(project_id).
-- INSERT allowed for anyone who can access the project (the trigger runs as
-- the acting user so their own activity passes). UPDATE/DELETE are admin-only
-- so the feed is effectively immutable.

ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity read" ON project_activity;
CREATE POLICY "Activity read" ON project_activity
  FOR SELECT TO authenticated
  USING (can_access_project(project_id));

DROP POLICY IF EXISTS "Activity insert" ON project_activity;
CREATE POLICY "Activity insert" ON project_activity
  FOR INSERT TO authenticated
  WITH CHECK (can_access_project(project_id));

DROP POLICY IF EXISTS "Activity admin manage" ON project_activity;
CREATE POLICY "Activity admin manage" ON project_activity
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
-- The hook streams new rows into the UI in real time, same pattern as the
-- tables PR 2 added.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'project_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_activity;
  END IF;

  EXECUTE 'ALTER TABLE project_activity REPLICA IDENTITY FULL';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger function — log activity for project-scoped tables
-- ─────────────────────────────────────────────────────────────────────────────
-- One generic function that dispatches on TG_TABLE_NAME. Each branch builds
-- a human-readable summary. Kept compact — the UI can hydrate richer info
-- from the entity row itself if it needs to.
--
-- SECURITY INVOKER: uses auth.uid() as actor_id. If a trigger fires in a
-- context without an authenticated user (e.g. edge function using the
-- service role), actor_id is NULL and actor_type defaults to 'system'.

CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_entity_id UUID;
  v_activity_type TEXT;
  v_summary TEXT;
  v_metadata JSONB := '{}'::jsonb;
  v_actor_id UUID;
  v_actor_type TEXT;
BEGIN
  -- Resolve actor
  v_actor_id := auth.uid();
  v_actor_type := CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'user' END;

  -- Resolve project_id and entity_id (project table uses id as both)
  IF TG_TABLE_NAME = 'projects' THEN
    v_project_id := COALESCE(NEW.id, OLD.id);
    v_entity_id := v_project_id;
  ELSE
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
    v_entity_id := COALESCE(NEW.id, OLD.id);
  END IF;

  IF v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve activity_type from TG_OP + special cases (status transitions)
  IF TG_OP = 'INSERT' THEN
    v_activity_type := 'created';
  ELSIF TG_OP = 'DELETE' THEN
    v_activity_type := 'deleted';
  ELSE
    v_activity_type := 'updated';
  END IF;

  -- Build per-table summary + override activity_type for status changes etc.
  CASE TG_TABLE_NAME
    WHEN 'daily_logs' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Logged daily update: ' || LEFT(NEW.summary, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted a daily log';
      ELSE
        v_summary := 'Edited a daily log';
      END IF;

    WHEN 'tasks' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added task: ' || LEFT(NEW.title, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted task: ' || LEFT(OLD.title, 80);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := CASE
          WHEN NEW.status = 'done' THEN 'completed'
          ELSE 'status_changed'
        END;
        v_summary := 'Task "' || LEFT(NEW.title, 60) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited task: ' || LEFT(NEW.title, 80);
      END IF;

    WHEN 'change_orders' THEN
      IF TG_OP = 'INSERT' THEN
        v_activity_type := 'flagged';
        v_summary := 'Flagged change order: ' || LEFT(NEW.title, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted change order: ' || LEFT(OLD.title, 80);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := 'Change order "' || LEFT(NEW.title, 50) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited change order: ' || LEFT(NEW.title, 80);
      END IF;

    WHEN 'punch_list_items' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added punch item: ' || LEFT(NEW.description, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted punch item';
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := CASE
          WHEN NEW.status = 'complete' THEN 'completed'
          ELSE 'status_changed'
        END;
        v_summary := 'Punch item "' || LEFT(NEW.description, 50) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited punch item';
      END IF;

    WHEN 'warranty_claims' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Filed warranty claim: ' || LEFT(NEW.description, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Deleted warranty claim';
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := 'Warranty claim → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited warranty claim';
      END IF;

    WHEN 'project_photos' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added a photo' || COALESCE(' — ' || LEFT(NEW.caption, 60), '');
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Removed a photo';
      ELSE
        v_summary := 'Edited a photo';
      END IF;

    WHEN 'shopping_list_items' THEN
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Added to shopping list: ' || LEFT(NEW.item_name, 80);
      ELSIF TG_OP = 'DELETE' THEN
        v_summary := 'Removed from shopping list: ' || LEFT(OLD.item_name, 80);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := '"' || LEFT(NEW.item_name, 50) || '" → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        v_summary := 'Edited shopping list item';
      END IF;

    WHEN 'messages' THEN
      -- Messages are write-only in practice; only log INSERT.
      IF TG_OP <> 'INSERT' THEN
        RETURN COALESCE(NEW, OLD);
      END IF;
      v_activity_type := 'commented';
      v_summary := 'Sent a message: ' || LEFT(NEW.message, 100);
      IF NEW.is_ai_generated IS TRUE THEN
        v_actor_type := 'ai';
      END IF;

    WHEN 'project_assignments' THEN
      IF TG_OP = 'INSERT' THEN
        v_activity_type := 'assigned';
        v_summary := 'Assigned someone to the project as ' || NEW.role;
        v_metadata := jsonb_build_object('employee_id', NEW.employee_id, 'role', NEW.role);
      ELSIF TG_OP = 'DELETE' THEN
        v_activity_type := 'unassigned';
        v_summary := 'Removed someone from the project';
        v_metadata := jsonb_build_object('employee_id', OLD.employee_id);
      ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
        IF NEW.active = false THEN
          v_activity_type := 'unassigned';
          v_summary := 'Removed someone from the project';
        ELSE
          v_activity_type := 'assigned';
          v_summary := 'Re-added someone to the project as ' || NEW.role;
        END IF;
        v_metadata := jsonb_build_object('employee_id', NEW.employee_id);
      ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
        v_summary := 'Changed role to ' || NEW.role;
        v_metadata := jsonb_build_object('from', OLD.role, 'to', NEW.role, 'employee_id', NEW.employee_id);
      ELSE
        -- other edits (e.g. updated_at bumps) — skip noise
        RETURN COALESCE(NEW, OLD);
      END IF;

    WHEN 'projects' THEN
      IF TG_OP = 'DELETE' THEN
        -- Project itself is going away; cascade will drop the activity anyway.
        RETURN OLD;
      END IF;
      IF TG_OP = 'INSERT' THEN
        v_summary := 'Project created';
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_activity_type := 'status_changed';
        v_summary := 'Project status → ' || NEW.status;
        v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSIF NEW.percent_complete IS DISTINCT FROM OLD.percent_complete THEN
        -- Progress ticks are noisy; only log at 25/50/75/100 boundaries
        IF NEW.percent_complete NOT IN (25, 50, 75, 100) THEN
          RETURN NEW;
        END IF;
        v_summary := 'Project progress → ' || NEW.percent_complete || '%';
        v_metadata := jsonb_build_object('from', OLD.percent_complete, 'to', NEW.percent_complete);
      ELSE
        -- Skip other project-row edits as noise
        RETURN NEW;
      END IF;

    ELSE
      -- Unknown table — skip quietly so adding a trigger by mistake doesn't
      -- spam garbage rows.
      RETURN COALESCE(NEW, OLD);
  END CASE;

  INSERT INTO project_activity (
    project_id, actor_id, actor_type, activity_type,
    entity_table, entity_id, summary, metadata
  ) VALUES (
    v_project_id, v_actor_id, v_actor_type, v_activity_type,
    TG_TABLE_NAME, v_entity_id, v_summary, v_metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Attach triggers
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  trigger_tables TEXT[] := ARRAY[
    'daily_logs',
    'tasks',
    'change_orders',
    'punch_list_items',
    'warranty_claims',
    'project_photos',
    'shopping_list_items',
    'messages',
    'project_assignments',
    'projects'
  ];
BEGIN
  FOREACH t IN ARRAY trigger_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_project_activity ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_project_activity '
      || 'AFTER INSERT OR UPDATE OR DELETE ON %I '
      || 'FOR EACH ROW EXECUTE FUNCTION log_project_activity()',
      t
    );
  END LOOP;
END $$;
