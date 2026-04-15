-- ============================================================================
-- PR 17 — Observability tables + comms timeline + improvement queue (Wave B)
-- ============================================================================
-- Closes the "table schema exists or is claimed in code, but nothing
-- reads/writes it" gap from the capability audit:
--
--   • communication_log — an earlier base-schema migration created a skeleton
--     table (id/lead_id/project_id/client_user_id/comm_type/direction/summary/
--     transcript/recording_url/duration_seconds/action_items/created_at), but
--     the admin ProjectDetailPage Comms tab still says "no real table yet,
--     show empty state." We ADD the missing columns the UI needs without
--     dropping or renaming anything — existing edge functions that INSERT
--     rows today keep working.
--
--   • error_log — HealthPage says "Error tracking not yet configured."
--     Brand-new table.
--
--   • agent_execution_log — HealthPage says "Agent monitoring not yet
--     configured." Brand-new table.
--
--   • improvement_suggestions — new meta-agent "what to improve" queue.
--     Distinct from the pre-existing improvement_specs table (that one is
--     dev-spec-shaped: problem_statement/evidence/proposed_solution/PR
--     workflow). This one is business-queue-shaped: category/priority/
--     status(open/ack/in_progress/done/dismissed) with review metadata.
--
-- All four tables are added to supabase_realtime with REPLICA IDENTITY FULL.
-- updated_at triggers added where the column exists.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. communication_log — extend pre-existing table with PR 17 columns
-- ─────────────────────────────────────────────────────────────────────────────
-- Pre-existing columns we keep as-is:
--   id, lead_id, project_id, client_user_id, comm_type, direction, summary,
--   transcript, recording_url, duration_seconds, action_items, created_at
--
-- PR 17 additions (all nullable so the retrofit is zero-impact):
--   channel, party_name, party_type, body, logged_by, logged_via,
--   occurred_at, updated_at
--
-- direction already has CHECK (direction IN ('inbound','outbound')). PR 17
-- needs 'internal' as well — widen the constraint.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='communication_log') THEN

    -- Add new columns only if missing.
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS channel TEXT;
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS party_name TEXT;
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS party_type TEXT;
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS body TEXT;
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS logged_by UUID REFERENCES profiles(id);
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS logged_via TEXT DEFAULT 'manual';
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    -- Backfill occurred_at from created_at where NULL, then enforce NOT NULL.
    UPDATE communication_log SET occurred_at = created_at WHERE occurred_at IS NULL;
    ALTER TABLE communication_log ALTER COLUMN occurred_at SET NOT NULL;

    -- Add check constraints if not already present.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'communication_log_channel_check'
    ) THEN
      ALTER TABLE communication_log
        ADD CONSTRAINT communication_log_channel_check
        CHECK (channel IS NULL OR channel IN ('email','sms','phone','in_app','meeting','other'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'communication_log_party_type_check'
    ) THEN
      ALTER TABLE communication_log
        ADD CONSTRAINT communication_log_party_type_check
        CHECK (party_type IS NULL OR party_type IN ('client','subcontractor','supplier','inspector','team','other'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'communication_log_logged_via_check'
    ) THEN
      ALTER TABLE communication_log
        ADD CONSTRAINT communication_log_logged_via_check
        CHECK (logged_via IS NULL OR logged_via IN ('manual','ai','import'));
    END IF;

    -- Widen direction CHECK to include 'internal'. Drop old, add new.
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'communication_log_direction_check'
    ) THEN
      ALTER TABLE communication_log DROP CONSTRAINT communication_log_direction_check;
    END IF;
    ALTER TABLE communication_log
      ADD CONSTRAINT communication_log_direction_check
      CHECK (direction IS NULL OR direction IN ('inbound','outbound','internal'));

    -- Indexes
    CREATE INDEX IF NOT EXISTS communication_log_project_occurred_idx
      ON communication_log(project_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS communication_log_logged_by_idx
      ON communication_log(logged_by) WHERE logged_by IS NOT NULL;

  END IF;
END $$;

-- RLS: mirror daily_logs — assigned read + admin/assigned-employee insert.
-- Base schema RLS migration already added "Admin full access" for
-- communication_log; we add the project-scoped SELECT/INSERT.

ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comm log read" ON communication_log;
CREATE POLICY "Comm log read" ON communication_log
  FOR SELECT TO authenticated
  USING (project_id IS NULL OR can_access_project(project_id));

DROP POLICY IF EXISTS "Comm log insert" ON communication_log;
CREATE POLICY "Comm log insert" ON communication_log
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (is_employee_or_admin() AND (project_id IS NULL OR can_access_project(project_id)))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. error_log — runtime errors from edge functions + frontend
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('edge_function','frontend','pg_trigger','cron','external')),
  function_name TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info','warn','error','fatal')),
  message TEXT NOT NULL,
  stack TEXT,
  metadata JSONB,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_log_severity_created_idx
  ON error_log(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS error_log_function_created_idx
  ON error_log(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS error_log_company_created_idx
  ON error_log(company_id, created_at DESC) WHERE company_id IS NOT NULL;

ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON error_log;
CREATE POLICY "Admin full access" ON error_log
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. agent_execution_log — every cron/event/manual agent run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron','event','manual','api')),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','success','failure','partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN finished_at IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::INTEGER
    END
  ) STORED,
  input_summary TEXT,
  output_summary TEXT,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS agent_execution_log_agent_started_idx
  ON agent_execution_log(agent_name, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_execution_log_status_started_idx
  ON agent_execution_log(status, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_execution_log_company_started_idx
  ON agent_execution_log(company_id, started_at DESC) WHERE company_id IS NOT NULL;

ALTER TABLE agent_execution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON agent_execution_log;
CREATE POLICY "Admin full access" ON agent_execution_log
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. improvement_suggestions — company-scoped "what to improve" queue
-- ─────────────────────────────────────────────────────────────────────────────
-- Distinct from improvement_specs (which is dev-spec-shaped with PR
-- workflow). This is the lightweight business queue agent-improvement-
-- analysis can write into on a weekly cadence.

CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_progress','done','dismissed')),
  source TEXT DEFAULT 'agent-improvement-analysis',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS improvement_suggestions_company_status_idx
  ON improvement_suggestions(company_id, status, created_at DESC);

ALTER TABLE improvement_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON improvement_suggestions;
CREATE POLICY "Admin full access" ON improvement_suggestions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at_now()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS communication_log_updated_at ON communication_log;
CREATE TRIGGER communication_log_updated_at
  BEFORE UPDATE ON communication_log
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();

DROP TRIGGER IF EXISTS improvement_suggestions_updated_at ON improvement_suggestions;
CREATE TRIGGER improvement_suggestions_updated_at
  BEFORE UPDATE ON improvement_suggestions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Supabase realtime publication — idempotent add + REPLICA IDENTITY FULL
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  realtime_tables TEXT[] := ARRAY[
    'communication_log',
    'error_log',
    'agent_execution_log',
    'improvement_suggestions'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  FOREACH t IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;

    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
