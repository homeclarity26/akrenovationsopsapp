-- K36: Extend warranty_claims
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS claim_number TEXT UNIQUE;
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS reported_via TEXT CHECK (reported_via IN (
  'phone', 'text', 'email', 'in_person', 'client_portal'
));
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES subcontractors(id);
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS sub_responsible BOOLEAN DEFAULT false;
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS sub_notified_at TIMESTAMPTZ;
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS estimated_repair_cost NUMERIC;
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS actual_repair_cost NUMERIC;
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS is_billable_to_sub BOOLEAN DEFAULT false;
ALTER TABLE warranty_claims ADD COLUMN IF NOT EXISTS client_satisfaction_after TEXT CHECK (client_satisfaction_after IN (
  'very_satisfied', 'satisfied', 'neutral', 'dissatisfied'
));

CREATE SEQUENCE IF NOT EXISTS warranty_claim_seq START 1;
