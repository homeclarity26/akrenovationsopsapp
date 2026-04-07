-- Migration: A5 — Create learning_insights table with vector index
-- Patterns extracted from the other memory stores by the meta agent on a weekly cycle.
-- Grows smarter over time: sub reliability, margin patterns, agent quality signals, etc.

create table if not exists learning_insights (
  id uuid primary key default gen_random_uuid(),
  insight_type text not null check (insight_type in (
    'sub_performance',
    'client_behavior',
    'project_financials',
    'agent_performance',
    'workflow_pattern',
    'improvement_signal'
  )),
  title text not null,
  insight text not null,
  evidence text,
  confidence numeric not null,
  entity_type text,
  entity_id uuid,
  embedding vector(1536),
  actioned boolean default false,
  action_taken text,
  generated_by text default 'meta_agent',
  generated_at timestamptz default now(),
  expires_at timestamptz
);

-- Vector index for semantic search
create index if not exists learning_insights_embedding_idx
  on learning_insights
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Standard indexes
create index if not exists learning_insights_type_idx
  on learning_insights (insight_type, actioned);

-- RLS
alter table learning_insights enable row level security;

create policy "Admin full access to learning_insights"
  on learning_insights
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
