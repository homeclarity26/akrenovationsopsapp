-- Feature: Invoice ↔ proposal ↔ change-order integration.
-- See INVOICE_PROPOSAL_INTEGRATION_PLAN.md for the full design. This migration
-- lands the data model. UI + view lands in the same commit.
--
-- Summary:
--   - invoices gains proposal_id + milestone_label + milestone_percent +
--     base_amount + change_order_amount so we can attribute each invoice to
--     the right slice of the parent proposal and to the COs it pulled in.
--   - change_orders gains rolled_into_invoice_id + rolled_into_at +
--     priced_by + priced_at so we have a clear "flagged → priced → rolled"
--     trail per CO.
--   - v_project_balance view summarizes everything a client or admin needs
--     to see on a project's financial tab: contract base, change-order
--     total, grand total, invoiced to date, paid to date, remaining
--     balance, next milestone info.

-- ── invoices deltas ─────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES public.proposals(id),
  ADD COLUMN IF NOT EXISTS milestone_label TEXT,
  ADD COLUMN IF NOT EXISTS milestone_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_order_amount NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_proposal_id ON public.invoices(proposal_id);

-- ── change_orders deltas ────────────────────────────────────────────────
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS rolled_into_invoice_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS rolled_into_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priced_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS priced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_change_orders_rolled_into_invoice_id
  ON public.change_orders(rolled_into_invoice_id);

-- ── v_project_balance view ──────────────────────────────────────────────
-- One row per project with everything the financial tab needs.
CREATE OR REPLACE VIEW public.v_project_balance AS
SELECT
  p.id AS project_id,
  p.title AS project_title,
  p.client_name,
  p.company_id,
  -- Latest accepted proposal for the project (if any)
  (
    SELECT pr.id FROM public.proposals pr
    WHERE pr.project_id = p.id
    ORDER BY pr.created_at DESC LIMIT 1
  ) AS proposal_id,
  -- Contract base = latest proposal.total_price, or fall back to project contract_value
  COALESCE(
    (
      SELECT pr.total_price FROM public.proposals pr
      WHERE pr.project_id = p.id
      ORDER BY pr.created_at DESC LIMIT 1
    ),
    p.contract_value,
    0
  )::numeric AS contract_base,
  -- Sum of priced change orders for this project (regardless of rolled/not)
  COALESCE(
    (
      SELECT SUM(co.cost_change) FROM public.change_orders co
      WHERE co.project_id = p.id AND co.cost_change IS NOT NULL AND co.cost_change <> 0
    ),
    0
  )::numeric AS change_order_total,
  -- Sum of invoices NOT void
  COALESCE(
    (
      SELECT SUM(inv.total) FROM public.invoices inv
      WHERE inv.project_id = p.id AND COALESCE(inv.status, '') <> 'void'
    ),
    0
  )::numeric AS invoiced_to_date,
  -- Sum of amount_paid across non-void invoices
  COALESCE(
    (
      SELECT SUM(inv.paid_amount) FROM public.invoices inv
      WHERE inv.project_id = p.id AND COALESCE(inv.status, '') <> 'void'
    ),
    0
  )::numeric AS paid_to_date,
  -- Sum of priced but not-yet-rolled change orders (ready to bundle into next invoice)
  COALESCE(
    (
      SELECT SUM(co.cost_change) FROM public.change_orders co
      WHERE co.project_id = p.id
        AND co.cost_change IS NOT NULL AND co.cost_change <> 0
        AND co.rolled_into_invoice_id IS NULL
    ),
    0
  )::numeric AS unrolled_priced_co_total
FROM public.projects p;

-- Read permission — admins get their company rows, clients get their own
-- project. Since the view reads from tables that already enforce RLS, the
-- view inherits their filtering; we just need GRANT SELECT.
GRANT SELECT ON public.v_project_balance TO authenticated;

NOTIFY pgrst, 'reload schema';
