-- B5: Add budget-related columns to project_files

ALTER TABLE project_files ADD COLUMN IF NOT EXISTS budget_category TEXT CHECK (budget_category IN ('sub_quote', 'sub_invoice', 'material_receipt', 'other_budget'));
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS budget_trade_id UUID REFERENCES budget_trades(id);
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS extracted_amount NUMERIC;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'complete', 'failed'));
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS extraction_data JSONB;
