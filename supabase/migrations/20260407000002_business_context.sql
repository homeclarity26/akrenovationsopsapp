-- Migration: A2 — Create business_context table with seed data
-- Stores who Adam is, how the business works, pricing rules, brand voice, workflow rules.
-- Changes rarely. Updated manually or by the meta agent.

create table if not exists business_context (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'identity',
    'preferences',
    'brand_voice',
    'pricing_rules',
    'workflow_rules',
    'employee_profiles',
    'sub_profiles',
    'client_patterns',
    'meta_rules'
  )),
  key text not null,
  value text not null,
  embedding vector(1536),
  source text default 'manual' check (source in ('manual', 'meta_agent', 'admin_action')),
  confidence numeric default 1.0,
  last_confirmed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(category, key)
);

-- RLS
alter table business_context enable row level security;

create policy "Admin full access to business_context"
  on business_context
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seed initial business context
insert into business_context (category, key, value) values
  ('identity',       'business_name',                    'AK Renovations'),
  ('identity',       'owner_name',                       'Adam Kilgore'),
  ('identity',       'service_area',                     'Summit County, Ohio — Akron, Cuyahoga Falls, Hudson, Stow, and surrounding areas'),
  ('identity',       'project_types',                    'Kitchens, bathrooms, basements, additions, first-floor transformations, large remodels'),
  ('identity',       'typical_contract_range',            '$15,000 to $150,000+'),
  ('pricing_rules',  'default_sub_markup',               '25%'),
  ('pricing_rules',  'target_gross_margin_standard',     '38%'),
  ('pricing_rules',  'target_gross_margin_addition',     '21-22%'),
  ('pricing_rules',  'pm_hourly_rate',                   '$120'),
  ('pricing_rules',  'crew_weekly_cost',                 '$3,300 combined for Jeff and Steven'),
  ('brand_voice',    'tone',                             'Professional, confident, approachable. Sounds like a trusted expert neighbor — not a salesman. Never corporate. Never AI-sounding. Direct and specific.'),
  ('brand_voice',    'never_do',                         'Em dashes. Filler phrases. Generic AI language. Robotic sentence structure. Overlong explanations.'),
  ('workflow_rules', 'approval_required_for',            'Any client-facing communication, invoices, proposals, contracts, social media posts, collection messages'),
  ('workflow_rules', 'auto_execute',                     'Receipt processing, photo tagging, daily log drafts, internal notes, shopping list additions, task status updates')
on conflict (category, key) do nothing;
