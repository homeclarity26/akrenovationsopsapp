-- Widen change_orders.status CHECK constraint so the new pricing + invoicing
-- flow can set status='priced' (admin has pushed a cost_change) and
-- status='invoiced' (admin has rolled it into an invoice). Both states were
-- added in 20260419100000 but the CHECK constraint from the base schema
-- didn't know about them, so UPDATEs rejected with a 23514.

ALTER TABLE public.change_orders
  DROP CONSTRAINT IF EXISTS change_orders_status_check;

ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_status_check
  CHECK (status = ANY (ARRAY[
    'flagged',   -- raised by the field, waiting for pricing
    'priced',    -- admin has set cost_change, ready to roll into an invoice
    'draft',
    'sent',
    'invoiced',  -- rolled into an invoice (rolled_into_invoice_id set)
    'approved',
    'declined'
  ]));
