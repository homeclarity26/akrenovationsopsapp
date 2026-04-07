-- Migration: A4 — Create agent_history table
-- Every output every agent has ever produced, what Adam did with it, and outcomes.
-- This is the learning signal — used by meta agent to improve agent quality over time.

create table if not exists agent_history (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  run_at timestamptz default now(),

  -- What the agent produced
  output_type text not null check (output_type in (
    'draft',
    'analysis',
    'action',
    'alert',
    'report'
  )),
  output_summary text not null,
  output_content text,
  output_metadata jsonb,

  -- What Adam did with it
  admin_action text check (admin_action in (
    'approved',
    'approved_with_edits',
    'rejected',
    'dismissed',
    'auto_executed',
    'pending'
  )) default 'pending',
  admin_action_at timestamptz,
  edit_distance integer,
  rejection_reason text,

  -- Learning signal
  outcome text,
  outcome_recorded_at timestamptz,

  -- Context used
  context_tokens_used integer,
  model_used text default 'claude-sonnet-4-20250514',

  created_at timestamptz default now()
);

-- Indexes
create index if not exists agent_history_agent_idx
  on agent_history (agent_name, run_at desc);

create index if not exists agent_history_action_idx
  on agent_history (admin_action);

-- RLS
alter table agent_history enable row level security;

create policy "Admin full access to agent_history"
  on agent_history
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
