-- Phase N: Universal Template System
-- N14-N17: Add template tracking columns to all instance tables

-- N14: sub_scopes
ALTER TABLE sub_scopes
  ADD COLUMN IF NOT EXISTS scope_template_id UUID REFERENCES scope_templates(id),
  ADD COLUMN IF NOT EXISTS template_version_at_generation INTEGER,
  ADD COLUMN IF NOT EXISTS diverged_from_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS divergence_summary JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS promoted_to_template_id UUID,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sub_scopes_scope_template ON sub_scopes(scope_template_id);
CREATE INDEX IF NOT EXISTS idx_sub_scopes_diverged ON sub_scopes(diverged_from_template) WHERE diverged_from_template = true;

-- N15: proposals
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS proposal_template_id UUID REFERENCES proposal_templates(id),
  ADD COLUMN IF NOT EXISTS template_version_at_generation INTEGER,
  ADD COLUMN IF NOT EXISTS diverged_from_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS divergence_summary JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS promoted_to_template_id UUID,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_proposals_proposal_template ON proposals(proposal_template_id);
CREATE INDEX IF NOT EXISTS idx_proposals_diverged ON proposals(diverged_from_template) WHERE diverged_from_template = true;

-- N16: sub_contracts
ALTER TABLE sub_contracts
  ADD COLUMN IF NOT EXISTS template_version_at_generation INTEGER,
  ADD COLUMN IF NOT EXISTS diverged_from_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS divergence_summary JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS promoted_to_template_id UUID,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sub_contracts_diverged ON sub_contracts(diverged_from_template) WHERE diverged_from_template = true;

-- N17: checklist_instances
ALTER TABLE checklist_instances
  ADD COLUMN IF NOT EXISTS template_version_at_generation INTEGER,
  ADD COLUMN IF NOT EXISTS diverged_from_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS divergence_summary JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS promoted_to_template_id UUID,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_checklist_instances_diverged ON checklist_instances(diverged_from_template) WHERE diverged_from_template = true;
