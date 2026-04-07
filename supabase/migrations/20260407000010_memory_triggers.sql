-- Migration: A10 — Database triggers for operational memory sync
-- These fire on key data changes and call update-operational-memory edge function.
-- Requires pg_net extension (already available in Supabase).
-- Run AFTER migrations 000001-000006 AND after edge functions are deployed.

-- Enable pg_net if not already enabled (needed for HTTP calls from triggers)
create extension if not exists pg_net;

-- ── Helper: fire edge function ───────────────────────────────────────────────

-- Store Supabase URL and service key as app settings so triggers can reference them.
-- Adam: run these two commands in the SQL editor with your actual values:
--   SELECT set_config('app.supabase_url', 'https://YOUR_PROJECT.supabase.co', false);
--   SELECT set_config('app.service_role_key', 'YOUR_SERVICE_ROLE_KEY', false);
-- Then add them to supabase/config.toml or use vault secrets.

-- ── Project status change trigger ────────────────────────────────────────────

create or replace function fn_project_memory_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'project',
        'entity_id',   new.id::text,
        'event',       'status_change',
        'old_value',   old.status,
        'new_value',   new.status
      )
    );
  end if;

  if (TG_OP = 'INSERT') then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'project',
        'entity_id',   new.id::text,
        'event',       'project_created',
        'new_value',   new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists project_memory_sync on projects;
create trigger project_memory_sync
  after insert or update on projects
  for each row execute function fn_project_memory_sync();


-- ── Invoice paid trigger ──────────────────────────────────────────────────────

create or replace function fn_invoice_memory_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'project',
        'entity_id',   new.project_id::text,
        'event',       'invoice_' || new.status,
        'old_value',   old.status,
        'new_value',   new.status,
        'metadata',    jsonb_build_object(
          'invoice_id',     new.id,
          'invoice_number', new.invoice_number,
          'amount',         new.total,
          'paid_amount',    new.paid_amount
        )
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_memory_sync on invoices;
create trigger invoice_memory_sync
  after update on invoices
  for each row execute function fn_invoice_memory_sync();


-- ── Proposal accepted trigger ─────────────────────────────────────────────────

create or replace function fn_proposal_memory_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'lead',
        'entity_id',   new.lead_id::text,
        'event',       'proposal_' || new.status,
        'old_value',   old.status,
        'new_value',   new.status,
        'metadata',    jsonb_build_object(
          'proposal_id',  new.id,
          'title',        new.title,
          'total_price',  new.total_price
        )
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_memory_sync on proposals;
create trigger proposal_memory_sync
  after update on proposals
  for each row execute function fn_proposal_memory_sync();


-- ── Lead stage change trigger ─────────────────────────────────────────────────

create or replace function fn_lead_memory_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and new.stage is distinct from old.stage) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'lead',
        'entity_id',   new.id::text,
        'event',       'stage_change',
        'old_value',   old.stage,
        'new_value',   new.stage
      )
    );
  end if;

  if (TG_OP = 'INSERT') then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'lead',
        'entity_id',   new.id::text,
        'event',       'lead_created',
        'new_value',   new.stage
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists lead_memory_sync on leads;
create trigger lead_memory_sync
  after insert or update on leads
  for each row execute function fn_lead_memory_sync();


-- ── Change order approved trigger ─────────────────────────────────────────────

create or replace function fn_change_order_memory_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'project',
        'entity_id',   new.project_id::text,
        'event',       'change_order_' || new.status,
        'old_value',   old.status,
        'new_value',   new.status,
        'metadata',    jsonb_build_object(
          'change_order_id', new.id,
          'title',           new.title,
          'cost_change',     new.cost_change
        )
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists change_order_memory_sync on change_orders;
create trigger change_order_memory_sync
  after update on change_orders
  for each row execute function fn_change_order_memory_sync();
