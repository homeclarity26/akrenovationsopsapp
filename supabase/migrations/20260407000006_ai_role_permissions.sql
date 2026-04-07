-- Migration: A6 — Create ai_role_permissions table with full seed data
-- Enforces what each role's AI can access and do.
-- Checked by the context assembler on every agent call.

create table if not exists ai_role_permissions (
  id uuid primary key default gen_random_uuid(),
  capability text not null,
  capability_description text,
  allowed_roles text[] not null,
  scope_restriction text,
  created_at timestamptz default now()
);

-- RLS
alter table ai_role_permissions enable row level security;

create policy "Admin full access to ai_role_permissions"
  on ai_role_permissions
  for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Employees and clients can read capabilities (read-only, for client/employee AI features)
create policy "Authenticated users can read ai_role_permissions"
  on ai_role_permissions
  for select
  to authenticated
  using (true);

-- Seed permissions
insert into ai_role_permissions (capability, capability_description, allowed_roles, scope_restriction) values
  ('query_financials',           'Read all financial data across projects',                        array['admin'],                   null),
  ('query_all_projects',         'Read all project data',                                          array['admin'],                   null),
  ('query_own_projects',         'Read projects assigned to this user',                            array['admin', 'employee'],       'assigned_only'),
  ('query_leads',                'Read lead and CRM data',                                         array['admin'],                   null),
  ('query_client_data',          'Read full client records',                                       array['admin'],                   null),
  ('query_employee_data',        'Read employee records and hours',                                array['admin'],                   null),
  ('trigger_receipt_processor',  'Submit a photo for AI receipt extraction',                       array['admin', 'employee'],       null),
  ('trigger_photo_tagger',       'Submit a photo for AI tagging',                                  array['admin', 'employee'],       null),
  ('trigger_voice_transcriber',  'Submit a voice recording for AI transcription',                  array['admin', 'employee'],       null),
  ('flag_change_order',          'Flag a potential change order from the field',                   array['admin', 'employee'],       null),
  ('formalize_change_order',     'Create and send a formal change order to the client',            array['admin'],                   null),
  ('send_client_comms',          'Send any communication directly to a client',                    array['admin'],                   null),
  ('create_invoices',            'Create and send invoices',                                       array['admin'],                   null),
  ('access_meta_agent',          'Access the meta agent conversation interface',                   array['admin'],                   null),
  ('view_morning_brief',         'View the AI-generated morning brief',                            array['admin'],                   null),
  ('receive_daily_log_draft',    'Receive a draft daily log for their project',                    array['admin', 'employee'],       'own_only'),
  ('receive_schedule_alerts',    'Receive AI schedule alerts for assigned projects',               array['admin', 'employee'],       'assigned_only'),
  ('client_project_queries',     'Ask AI questions about their own project',                       array['admin', 'client'],         'own_project_only'),
  ('bulk_actions',               'Execute bulk operations across multiple records',                 array['admin'],                   null),
  ('cross_project_intelligence', 'Query patterns and insights across all projects',                array['admin'],                   null)
on conflict do nothing;
