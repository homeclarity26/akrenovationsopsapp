-- K20: Add supplier_id to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
