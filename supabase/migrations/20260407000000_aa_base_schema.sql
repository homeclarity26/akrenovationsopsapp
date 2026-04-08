-- ============================================================================
-- BOOTSTRAP — Base CLAUDE.md schema
-- ============================================================================
-- This file creates every base table referenced by CLAUDE.md that the
-- feature-phase migrations (A through L) assume already exists. It must run
-- before any other migration. The 0000 timestamp prefix guarantees that.
--
-- Idempotent: every CREATE uses IF NOT EXISTS so re-running is safe.
-- RLS: NOT enabled here. Phase M task M21 will enable RLS + baseline policies
-- across all base tables in a single belt-and-suspenders migration.
-- ============================================================================

-- ── Auth & Users ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'client')),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  hourly_rate NUMERIC,
  base_salary NUMERIC,
  start_date DATE,
  emergency_contact TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── CRM & Leads ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'OH',
  zip TEXT,
  source TEXT CHECK (source IN ('website', 'google_ads', 'referral', 'manual', 'facebook', 'other')),
  referral_source TEXT,
  referrer_id UUID REFERENCES leads(id),
  project_type TEXT,
  project_description TEXT,
  estimated_value NUMERIC,
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'consultation', 'proposal_sent', 'contract_signed', 'active_project', 'complete', 'lost')),
  stage_entered_at TIMESTAMPTZ DEFAULT now(),
  next_action TEXT,
  next_action_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  lost_reason TEXT,
  consultation_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'text', 'meeting', 'site_visit', 'stage_change', 'ai_action')),
  description TEXT NOT NULL,
  metadata JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_lead_id UUID REFERENCES leads(id),
  referred_lead_id UUID REFERENCES leads(id),
  notification_type TEXT CHECK (notification_type IN ('project_started', 'project_complete')),
  sent_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Projects ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  title TEXT NOT NULL,
  project_type TEXT NOT NULL,
  description TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_user_id UUID REFERENCES profiles(id),
  address TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'OH',
  zip TEXT,
  contract_value NUMERIC NOT NULL DEFAULT 0,
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  target_margin NUMERIC DEFAULT 0.38,
  actual_margin NUMERIC,
  estimated_start_date DATE,
  actual_start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  estimated_duration_weeks INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'on_hold', 'complete', 'cancelled')),
  schedule_status TEXT DEFAULT 'on_track' CHECK (schedule_status IN ('on_track', 'at_risk', 'behind', 'ahead')),
  current_phase TEXT,
  percent_complete INTEGER DEFAULT 0,
  warranty_months INTEGER DEFAULT 12,
  warranty_expiry DATE,
  geofence_lat NUMERIC,
  geofence_lng NUMERIC,
  geofence_radius_meters INTEGER DEFAULT 200,
  bonus_eligible BOOLEAN DEFAULT true,
  bonus_schedule_hit BOOLEAN,
  bonus_margin_hit BOOLEAN,
  bonus_amount_per_employee NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'complete')),
  percent_complete INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id),
  role TEXT DEFAULT 'crew',
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- ── Estimates & Proposals ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  project_type TEXT NOT NULL,
  walkthrough_data JSONB NOT NULL,
  material_list JSONB,
  labor_estimate JSONB,
  total_estimated_cost NUMERIC,
  total_proposed_price NUMERIC,
  margin_percent NUMERIC,
  photos TEXT[],
  voice_notes TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'complete', 'converted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id),
  lead_id UUID REFERENCES leads(id),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  project_type TEXT NOT NULL,
  overview_title TEXT,
  overview_body TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  selections JSONB,
  total_price NUMERIC,
  add_ons JSONB,
  duration TEXT,
  is_multi_option BOOLEAN DEFAULT false,
  options JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  pdf_url TEXT,
  docx_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id),
  project_id UUID REFERENCES projects(id),
  lead_id UUID REFERENCES leads(id),
  title TEXT NOT NULL,
  contract_body JSONB,
  total_value NUMERIC NOT NULL,
  payment_schedule JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'voided')),
  sent_at TIMESTAMPTZ,
  sent_via TEXT CHECK (sent_via IN ('email', 'sms', 'in_app')),
  client_signature_data TEXT,
  client_signed_at TIMESTAMPTZ,
  client_signed_ip TEXT,
  admin_signature_data TEXT,
  admin_signed_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Financial ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  po_number TEXT NOT NULL UNIQUE,
  vendor TEXT NOT NULL,
  items JSONB NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'partial', 'cancelled')),
  sent_at TIMESTAMPTZ,
  expected_delivery DATE,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  proposal_id UUID REFERENCES proposals(id),
  invoice_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT DEFAULT 'single' CHECK (payment_mode IN ('single', 'partial', 'milestone')),
  deposit_label TEXT,
  deposit_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial_paid', 'overdue', 'voided')),
  due_date DATE,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC DEFAULT 0,
  payment_method TEXT,
  pdf_url TEXT,
  qb_invoice_id TEXT,
  qb_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  vendor TEXT,
  description TEXT,
  category TEXT CHECK (category IN ('materials', 'labor', 'subcontractor', 'equipment_rental', 'permit', 'delivery', 'misc')),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  receipt_image_url TEXT,
  receipt_data JSONB,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  entered_by UUID REFERENCES profiles(id),
  entry_method TEXT DEFAULT 'manual' CHECK (entry_method IN ('manual', 'receipt_scan', 'purchase_order')),
  qb_expense_id TEXT,
  qb_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Employee Tools ──────────────────────────────────────────────────────────
-- NOTE: time_entries here is the LEGACY shape. Phase F migration F1 renames
-- this table to time_entries_legacy and creates a new time_entries with the
-- multi-segment / billing schema. This shape MUST match what F1 expects to rename.

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  total_hours NUMERIC,
  clock_in_lat NUMERIC,
  clock_in_lng NUMERIC,
  clock_out_lat NUMERIC,
  clock_out_lng NUMERIC,
  geofence_verified BOOLEAN,
  entry_type TEXT DEFAULT 'live' CHECK (entry_type IN ('live', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit TEXT,
  notes TEXT,
  status TEXT DEFAULT 'needed' CHECK (status IN ('needed', 'purchased', 'ordered', 'delivered')),
  purchased_by UUID REFERENCES profiles(id),
  purchased_at TIMESTAMPTZ,
  expense_id UUID REFERENCES expenses(id),
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  employee_id UUID NOT NULL REFERENCES profiles(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,
  work_completed TEXT,
  issues TEXT,
  weather TEXT,
  workers_on_site TEXT[],
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  sort_order INTEGER,
  created_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Photos & Files ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  uploaded_by UUID REFERENCES profiles(id),
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT CHECK (category IN ('demo', 'rough_in', 'progress', 'finish', 'issue', 'before_after')),
  caption TEXT,
  phase TEXT,
  ai_tags JSONB,
  ai_description TEXT,
  taken_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  uploaded_by UUID REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  category TEXT CHECK (category IN ('blueprint', 'spec_sheet', 'permit', 'contract', 'proposal', 'invoice', 'insurance', 'photo', 'other')),
  description TEXT,
  visible_to_client BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Client Selections ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  proposal_id UUID REFERENCES proposals(id),
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  where_to_shop TEXT,
  selected_product TEXT,
  selected_brand TEXT,
  selected_model TEXT,
  selected_color TEXT,
  selected_image_url TEXT,
  product_url TEXT,
  estimated_cost NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'approved', 'ordered', 'received')),
  sort_order INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Change Orders ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  flagged_by UUID REFERENCES profiles(id),
  flagged_at TIMESTAMPTZ,
  flagged_photos TEXT[],
  formalized_by UUID REFERENCES profiles(id),
  scope_change TEXT,
  cost_change NUMERIC DEFAULT 0,
  schedule_change_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'flagged' CHECK (status IN ('flagged', 'draft', 'sent', 'approved', 'declined')),
  client_approved_at TIMESTAMPTZ,
  client_signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Punch Lists & Warranty ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  description TEXT NOT NULL,
  location TEXT,
  photo_url TEXT,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'complete')),
  completed_at TIMESTAMPTZ,
  completed_photo_url TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  description TEXT NOT NULL,
  reported_by TEXT,
  reported_at TIMESTAMPTZ DEFAULT now(),
  photos TEXT[],
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'scheduled', 'in_progress', 'resolved', 'denied')),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Subcontractors ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  trade TEXT NOT NULL,
  insurance_expiry DATE,
  license_number TEXT,
  rating INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  scope TEXT,
  bid_amount NUMERIC,
  contracted_amount NUMERIC,
  paid_amount NUMERIC DEFAULT 0,
  scheduled_start DATE,
  scheduled_end DATE,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('bidding', 'scheduled', 'active', 'complete', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Communication ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  sender_id UUID REFERENCES profiles(id),
  sender_role TEXT,
  recipient_id UUID REFERENCES profiles(id),
  channel TEXT DEFAULT 'in_app' CHECK (channel IN ('in_app', 'sms', 'email')),
  message TEXT NOT NULL,
  attachments JSONB,
  is_read BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  project_id UUID REFERENCES projects(id),
  client_user_id UUID REFERENCES profiles(id),
  comm_type TEXT NOT NULL CHECK (comm_type IN ('call', 'sms', 'email', 'meeting', 'voice_note', 'in_app')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  summary TEXT,
  transcript TEXT,
  recording_url TEXT,
  duration_seconds INTEGER,
  action_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  subject TEXT,
  body TEXT NOT NULL,
  photos TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  sent_at TIMESTAMPTZ,
  sent_via TEXT CHECK (sent_via IN ('email', 'sms', 'in_app')),
  ai_generated BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Permits (must come before schedule_events because schedule_events references it) ──

CREATE TABLE IF NOT EXISTS permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  permit_type TEXT NOT NULL,
  permit_number TEXT,
  jurisdiction TEXT,
  status TEXT DEFAULT 'needed' CHECK (status IN ('needed', 'applied', 'approved', 'expired')),
  applied_date DATE,
  approved_date DATE,
  expiry_date DATE,
  fee NUMERIC,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Scheduling ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK (event_type IN ('work_day', 'consultation', 'site_visit', 'inspection', 'delivery', 'sub_work', 'milestone', 'meeting', 'other')),
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  assigned_to UUID[] DEFAULT '{}',
  location TEXT,
  inspection_type TEXT,
  inspection_status TEXT CHECK (inspection_status IN ('scheduled', 'passed', 'failed', 'rescheduled')),
  permit_id UUID REFERENCES permits(id),
  google_calendar_event_id TEXT,
  recurrence TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Templates (legacy AI walkthrough/scope templates table) ─────────────────

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL CHECK (template_type IN ('proposal_scope', 'selection_list', 'email', 'contract_terms', 'walkthrough', 'phase_list')),
  project_type TEXT,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── AI Agent ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES profiles(id),
  request_text TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB,
  requires_approval BOOLEAN DEFAULT true,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'rejected', 'failed')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  messages JSONB NOT NULL DEFAULT '[]',
  context_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Satisfaction & Reviews ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  feedback TEXT,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  platform TEXT DEFAULT 'google' CHECK (platform IN ('google', 'facebook', 'houzz', 'yelp')),
  review_link TEXT,
  sent_at TIMESTAMPTZ,
  delay_days INTEGER DEFAULT 7,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Bonus Tracking ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bonus_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  employee_id UUID NOT NULL REFERENCES profiles(id),
  project_type TEXT NOT NULL,
  bonus_amount NUMERIC NOT NULL,
  schedule_target_met BOOLEAN,
  margin_target_met BOOLEAN,
  qualified BOOLEAN,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  pay_period TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- END BOOTSTRAP
-- ============================================================================
