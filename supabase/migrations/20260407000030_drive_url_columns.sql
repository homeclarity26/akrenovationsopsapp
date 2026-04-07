-- C1: Add drive_url to all document tables

ALTER TABLE proposals     ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE contracts     ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE invoices      ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE daily_logs    ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE proposals     ADD COLUMN IF NOT EXISTS pdf_url TEXT;
