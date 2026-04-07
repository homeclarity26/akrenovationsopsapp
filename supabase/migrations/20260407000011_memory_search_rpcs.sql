-- Migration: A11 — Semantic search RPC functions for the memory layer
-- These are called by the assemble-context edge function.
-- Requires pgvector (migration 000001) and all memory tables to exist.

-- ── Business context semantic search ─────────────────────────────────────────

create or replace function search_business_context(
  query_embedding     vector(1536),
  allowed_categories  text[],
  match_count         int default 15
)
returns table (
  id        uuid,
  category  text,
  key       text,
  value     text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    bc.id,
    bc.category,
    bc.key,
    bc.value,
    1 - (bc.embedding <=> query_embedding) as similarity
  from business_context bc
  where
    bc.embedding is not null
    and bc.category = any(allowed_categories)
  order by bc.embedding <=> query_embedding
  limit match_count;
end;
$$;


-- ── Operational memory semantic search ───────────────────────────────────────

create or replace function search_operational_memory(
  query_embedding     vector(1536),
  entity_type_filter  text default null,
  entity_id_filter    uuid default null,
  allowed_types       text[] default array['fact','pattern','preference','warning','relationship','outcome'],
  match_count         int default 20
)
returns table (
  id           uuid,
  entity_type  text,
  entity_id    uuid,
  memory_type  text,
  content      text,
  confidence   numeric,
  similarity   float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    om.id,
    om.entity_type,
    om.entity_id,
    om.memory_type,
    om.content,
    om.confidence,
    1 - (om.embedding <=> query_embedding) as similarity
  from operational_memory om
  where
    om.embedding is not null
    and om.memory_type = any(allowed_types)
    and (entity_type_filter is null or om.entity_type = entity_type_filter)
    and (entity_id_filter is null or om.entity_id = entity_id_filter)
    and (om.expires_at is null or om.expires_at > now())
  order by om.embedding <=> query_embedding
  limit match_count;
end;
$$;


-- ── Learning insights semantic search ────────────────────────────────────────

create or replace function search_learning_insights(
  query_embedding     vector(1536),
  entity_type_filter  text default null,
  match_count         int default 5
)
returns table (
  id            uuid,
  insight_type  text,
  title         text,
  insight       text,
  confidence    numeric,
  similarity    float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    li.id,
    li.insight_type,
    li.title,
    li.insight,
    li.confidence,
    1 - (li.embedding <=> query_embedding) as similarity
  from learning_insights li
  where
    li.embedding is not null
    and li.actioned = false
    and (entity_type_filter is null or li.entity_type = entity_type_filter)
    and (li.expires_at is null or li.expires_at > now())
  order by li.embedding <=> query_embedding
  limit match_count;
end;
$$;
