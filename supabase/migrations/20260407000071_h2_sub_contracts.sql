-- H2: Create sub_contracts table + sequence + trigger

CREATE TABLE IF NOT EXISTS sub_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_id UUID NOT NULL REFERENCES sub_scopes(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  budget_quote_id UUID REFERENCES budget_quotes(id),

  -- Document identity
  contract_number TEXT UNIQUE,
  revision INTEGER DEFAULT 1,

  -- Contract terms
  contract_amount NUMERIC NOT NULL,
  payment_schedule JSONB NOT NULL,
  retention_percent NUMERIC DEFAULT 10,
  start_date DATE,
  completion_date DATE,
  liquidated_damages_per_day NUMERIC,

  -- Insurance requirements
  required_gl_amount NUMERIC DEFAULT 1000000,
  required_wc BOOLEAN DEFAULT true,
  additional_insured BOOLEAN DEFAULT true,

  -- Template version used
  template_version TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'attorney_review',
    'approved',
    'sent',
    'signed',
    'voided'
  )),

  -- Signatures
  sub_signature_data TEXT,
  sub_signed_at TIMESTAMPTZ,
  sub_signed_ip TEXT,
  akr_signature_data TEXT,
  akr_signed_at TIMESTAMPTZ,

  -- Files
  pdf_url TEXT,
  signed_pdf_url TEXT,
  drive_url TEXT,
  docx_url TEXT,

  -- Attorney tracking
  attorney_reviewed BOOLEAN DEFAULT false,
  attorney_approved_template BOOLEAN DEFAULT false,
  attorney_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_contracts_project_id ON sub_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_sub_contracts_scope_id ON sub_contracts(scope_id);
CREATE INDEX IF NOT EXISTS idx_sub_contracts_subcontractor_id ON sub_contracts(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sub_contracts_status ON sub_contracts(status);

-- Auto-increment contract number
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_number IS NULL THEN
    NEW.contract_number := 'SC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('contract_number_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_contract_number ON sub_contracts;
CREATE TRIGGER set_contract_number
  BEFORE INSERT ON sub_contracts
  FOR EACH ROW EXECUTE FUNCTION generate_contract_number();

CREATE OR REPLACE FUNCTION update_sub_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sub_contracts_updated_at ON sub_contracts;
CREATE TRIGGER sub_contracts_updated_at
  BEFORE UPDATE ON sub_contracts
  FOR EACH ROW EXECUTE FUNCTION update_sub_contracts_updated_at();

-- RLS — admin only
ALTER TABLE sub_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to sub_contracts"
  ON sub_contracts FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
