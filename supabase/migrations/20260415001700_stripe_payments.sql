-- Stripe payment columns on invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
