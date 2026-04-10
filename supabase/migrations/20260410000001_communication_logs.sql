-- Phase 2: Communication timeline (H-11)
-- Stores all emails, texts, phone calls, and in-app messages in one timeline per project/client.

CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID, -- references client or lead
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'in_app', 'portal')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body TEXT,
  sender_name TEXT,
  sender_identifier TEXT, -- email address or phone number
  metadata JSONB DEFAULT '{}', -- duration for calls, read receipt for email, etc.
  action_items JSONB DEFAULT '[]', -- auto-generated action items
  action_item_assignee TEXT CHECK (action_item_assignee IN ('ai_agent', 'owner', 'employee')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company communications"
  ON communication_logs FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert communications"
  ON communication_logs FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_comms_project_id ON communication_logs(project_id, logged_at DESC);
CREATE INDEX idx_comms_company_id ON communication_logs(company_id, logged_at DESC);
CREATE INDEX idx_comms_contact_id ON communication_logs(contact_id, logged_at DESC);
