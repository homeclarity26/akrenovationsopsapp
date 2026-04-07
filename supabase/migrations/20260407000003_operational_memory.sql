-- Migration: A3 — Create operational_memory table with vector index
-- Stores everything that has happened: projects, clients, subs, interactions.
-- Updated continuously by database triggers via update-operational-memory edge function.

create table if not exists operational_memory (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'project', 'client', 'lead', 'subcontractor', 'employee', 'vendor'
  )),
  entity_id uuid not null,
  memory_type text not null check (memory_type in (
    'fact',
    'pattern',
    'preference',
    'warning',
    'relationship',
    'outcome'
  )),
  content text not null,
  embedding vector(1536),
  confidence numeric default 1.0,
  source text not null check (source in (
    'database_trigger',
    'agent_inference',
    'meta_agent',
    'admin_input'
  )),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Vector index for semantic search (cosine similarity)
create index if not exists operational_memory_embedding_idx
  on operational_memory
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Standard indexes for filtered queries
create index if not exists operational_memory_entity_idx
  on operational_memory (entity_type, entity_id);

create index if not exists operational_memory_type_idx
  on operational_memory (memory_type);

-- RLS
alter table operational_memory enable row level security;

create policy "Admin full access to operational_memory"
  on operational_memory
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
