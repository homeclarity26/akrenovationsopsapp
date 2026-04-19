-- Add payment_schedule JSONB to proposals — the list of milestones that
-- BuildInvoiceFromProposalSheet draws radio options from. Shape:
--   [{ label: 'Deposit', percent: 0.3 }, ...]
-- Percents are 0..1 of the contract base. A proposal without a schedule
-- just falls back to the "Custom amount" radio in the sheet.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_schedule JSONB;

NOTIFY pgrst, 'reload schema';
