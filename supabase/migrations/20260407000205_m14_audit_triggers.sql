-- M14: audit_trigger_function + apply to every sensitive table
--
-- Per Adam's explicit instruction: "do not apply them only to new tables.
-- Go back through the existing schema and apply them to invoices, contracts,
-- payroll records, profiles, time entries, expenses, and every other table
-- containing financial or personal data."
--
-- Categories of "sensitive" we cover:
--   - All financial: invoices, expenses, contracts, proposals, estimates,
--     purchase_orders, budget_quotes, sub_contracts, change_orders
--   - All personal/HR: profiles, time_entries, compensation_components,
--     benefits_enrollment, payroll_records, payroll_adjustments, mileage_logs,
--     payroll_ytd, work_type_rates, bonus_records
--   - All compliance/legal: compliance_items, sub_scopes, contract_templates,
--     warranty_claims
--   - All client communication: messages, communication_log,
--     client_progress_updates, client_selections
--   - All AI/automation history: ai_actions
--   - Lead pipeline: leads, lead_activities

-- ─────────────────────────────────────────────────────────────────────────────
-- Generic audit trigger function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old JSONB;
  v_new JSONB;
  v_rec_id UUID;
  v_user_role TEXT;
BEGIN
  -- Determine action and capture rows
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_rec_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_rec_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_rec_id := OLD.id;
  END IF;

  -- Strip sensitive fields BEFORE logging. Even if a column is added later
  -- with one of these names, the strip will catch it. The "-" operator on
  -- jsonb removes a key if present and is a no-op otherwise.
  IF v_old IS NOT NULL THEN
    v_old := v_old
      - 'password' - 'password_hash' - 'encrypted_password'
      - 'ssn' - 'bank_account' - 'routing_number'
      - 'service_role_key' - 'access_token' - 'refresh_token';
  END IF;
  IF v_new IS NOT NULL THEN
    v_new := v_new
      - 'password' - 'password_hash' - 'encrypted_password'
      - 'ssn' - 'bank_account' - 'routing_number'
      - 'service_role_key' - 'access_token' - 'refresh_token';
  END IF;

  -- Try to capture the user's role at the time of the action
  BEGIN
    SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_role := NULL;
  END;

  INSERT INTO audit_log (
    user_id, user_role, action, table_name, record_id, old_values, new_values
  ) VALUES (
    auth.uid(),
    v_user_role,
    v_action,
    TG_TABLE_NAME,
    v_rec_id,
    v_old,
    v_new
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: drop existing audit trigger if any, then create fresh one
-- (idempotent — safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  audit_tables TEXT[] := ARRAY[
    -- Financial
    'invoices', 'expenses', 'contracts', 'proposals', 'estimates',
    'purchase_orders', 'budget_quotes', 'sub_contracts', 'change_orders',
    -- Personal / HR / Payroll
    'profiles', 'time_entries', 'compensation_components',
    'benefits_enrollment', 'payroll_records', 'payroll_adjustments',
    'mileage_logs', 'payroll_ytd', 'work_type_rates', 'bonus_records',
    -- Compliance / legal
    'compliance_items', 'sub_scopes', 'contract_templates', 'warranty_claims',
    -- Client communication
    'messages', 'communication_log', 'client_progress_updates', 'client_selections',
    -- AI automation history
    'ai_actions',
    -- Lead pipeline
    'leads', 'lead_activities'
  ];
BEGIN
  FOREACH t IN ARRAY audit_tables LOOP
    -- Only attach the trigger if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_trg_%I ON %I', t, t);
      EXECUTE format(
        'CREATE TRIGGER audit_trg_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()',
        t, t
      );
    END IF;
  END LOOP;
END $$;
