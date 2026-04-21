-- AI-First rebuild — Phase 0 Foundation.
--
-- Adds the 5 tables that power the new chat-first assistant + 2 boolean
-- columns on profiles (the per-user feature flag + TTS toggle). All new
-- code paths are gated by ai_v2_enabled which defaults to false, so this
-- migration is non-destructive and ships dormant.
--
-- See AI_FIRST_REBUILD_PLAN.md on Adam's Desktop for the design doc.

BEGIN;

-- ── 1. Threads ──────────────────────────────────────────────────────
-- 24h-idle lifecycle. Auto-archived (summary written via Haiku) when
-- last_message_at < now() - 24h. New thread auto-created on next user msg.
CREATE TABLE IF NOT EXISTS ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  persona TEXT NOT NULL CHECK (persona IN ('admin','employee','client','platform_owner')),
  company_id UUID REFERENCES companies(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  summary TEXT,
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_threads_user_recent
  ON ai_threads(user_id, last_message_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_threads_user_archived
  ON ai_threads(user_id, archived_at DESC) WHERE archived_at IS NOT NULL;

-- ── 2. Messages ─────────────────────────────────────────────────────
-- Includes assistant tool-call requests + tool-result rows so the entire
-- conversation can be replayed verbatim. quick_replies is the structured
-- chip payload the renderer uses (always includes "Something else").
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT,
  tool_call JSONB,
  tool_result JSONB,
  quick_replies JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_messages_thread
  ON ai_messages(thread_id, created_at);

-- ── 3. Tool calls (immutable audit log) ─────────────────────────────
-- Every tool invocation. Idempotency key dedup'd within 10 min so a
-- retry can't double-clock-in. Append-only — no UPDATE policy.
CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  thread_id UUID REFERENCES ai_threads(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  latency_ms INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_tool_calls_idem
  ON ai_tool_calls(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS ai_tool_calls_recent
  ON ai_tool_calls(user_id, started_at DESC);

-- ── 4. Memory (long-term facts) ─────────────────────────────────────
-- Claude can write/read via memory tools. Scope = 'user:UUID' or
-- 'project:UUID' or 'company:UUID'. Unique per scope+key (UPSERT).
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_by TEXT NOT NULL CHECK (created_by IN ('ai','user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_memory_scope_key_unique UNIQUE(scope, key)
);
CREATE INDEX IF NOT EXISTS ai_memory_scope ON ai_memory(scope);

-- ── 5. Usage ledger ($75/mo cap enforcement) ────────────────────────
-- Every Claude call writes one row. Hard cap calculated by summing
-- cost_usd over current calendar month for the company. Prompt-cached
-- tokens tracked separately so we can verify the discount.
CREATE TABLE IF NOT EXISTS ai_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  thread_id UUID REFERENCES ai_threads(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  cached_input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('chat','suggestion','summarize','tool_llm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Range scan handles month-to-date queries; date_trunc isn't IMMUTABLE
-- so it can't go in the index expression. Plain (company_id, created_at)
-- index serves the WHERE created_at >= date_trunc('month', now()) filter.
CREATE INDEX IF NOT EXISTS ai_usage_company_created
  ON ai_usage_ledger(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_user
  ON ai_usage_ledger(user_id, created_at DESC);

-- ── 6. Profiles flags ───────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_v2_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_tts_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── 7. RLS ──────────────────────────────────────────────────────────
ALTER TABLE ai_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_calls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- Threads: users see their own. Admin reads their company. Platform owner reads all.
CREATE POLICY "ai_threads_user_select" ON ai_threads
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_platform_owner()
    OR (is_admin() AND company_id = my_company_id())
  );
CREATE POLICY "ai_threads_user_insert" ON ai_threads
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_threads_user_update" ON ai_threads
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ai_threads_service_all" ON ai_threads
  FOR ALL USING (auth.role() = 'service_role');

-- Messages: scoped through their thread.
CREATE POLICY "ai_messages_thread_select" ON ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_threads t
      WHERE t.id = ai_messages.thread_id
        AND (t.user_id = auth.uid()
             OR is_platform_owner()
             OR (is_admin() AND t.company_id = my_company_id()))
    )
  );
CREATE POLICY "ai_messages_thread_insert" ON ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_threads t
      WHERE t.id = ai_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "ai_messages_service_all" ON ai_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Tool calls: append-only audit. Users see their own. Admin reads company.
CREATE POLICY "ai_tool_calls_select" ON ai_tool_calls
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_platform_owner()
    OR is_admin()  -- intentionally not company-scoped at this layer; tools enforce
  );
CREATE POLICY "ai_tool_calls_service_all" ON ai_tool_calls
  FOR ALL USING (auth.role() = 'service_role');
-- No user INSERT/UPDATE/DELETE — service-role only.

-- Memory: users see/edit memory scoped to themselves or to a project they
-- can access. Cross-scope writes go through service-role from the AI.
CREATE POLICY "ai_memory_user_select" ON ai_memory
  FOR SELECT USING (
    scope = 'user:' || auth.uid()::text
    OR (scope LIKE 'project:%' AND can_access_project(substring(scope from 9)::uuid))
    OR (scope LIKE 'company:%' AND substring(scope from 9)::uuid = my_company_id() AND is_admin())
    OR is_platform_owner()
  );
CREATE POLICY "ai_memory_user_delete" ON ai_memory
  FOR DELETE USING (scope = 'user:' || auth.uid()::text OR is_platform_owner());
CREATE POLICY "ai_memory_service_all" ON ai_memory
  FOR ALL USING (auth.role() = 'service_role');

-- Usage ledger: users see their own. Admin reads company. Platform owner reads all.
CREATE POLICY "ai_usage_ledger_select" ON ai_usage_ledger
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_platform_owner()
    OR (is_admin() AND company_id = my_company_id())
  );
CREATE POLICY "ai_usage_ledger_service_all" ON ai_usage_ledger
  FOR ALL USING (auth.role() = 'service_role');
-- No user INSERT/UPDATE — service-role only.

-- ── 8. Helper: month-to-date AI spend for a company ─────────────────
-- Used by the budget gate in agent-tool-call.
CREATE OR REPLACE FUNCTION public.ai_spend_this_month(p_company_id UUID)
  RETURNS NUMERIC
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)
  FROM ai_usage_ledger
  WHERE company_id = p_company_id
    AND created_at >= date_trunc('month', now());
$$;
GRANT EXECUTE ON FUNCTION public.ai_spend_this_month(UUID) TO authenticated, service_role;

COMMIT;
