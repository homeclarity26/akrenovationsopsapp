-- I24: When a bonus_records row is created/qualified, auto-create a payroll_adjustments
-- row in the next open pay period for that employee. Guarded so it no-ops if
-- bonus_records does not yet exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bonus_records') THEN

    CREATE OR REPLACE FUNCTION bonus_record_to_payroll_adjustment()
    RETURNS TRIGGER AS $body$
    DECLARE
      next_period_id UUID;
    BEGIN
      -- Only act when the bonus becomes qualified
      IF NEW.qualified IS NOT TRUE THEN RETURN NEW; END IF;
      IF (TG_OP = 'UPDATE' AND OLD.qualified IS TRUE) THEN RETURN NEW; END IF;

      SELECT id INTO next_period_id
      FROM pay_periods
      WHERE status IN ('open', 'upcoming')
      ORDER BY pay_date ASC
      LIMIT 1;

      IF next_period_id IS NULL THEN RETURN NEW; END IF;

      INSERT INTO payroll_adjustments (
        pay_period_id,
        profile_id,
        adjustment_type,
        amount,
        is_taxable,
        description,
        reference_id,
        project_id,
        created_by
      )
      VALUES (
        next_period_id,
        NEW.employee_id,
        'bonus',
        NEW.bonus_amount,
        true,
        'Project bonus — ' || COALESCE(NEW.project_type, 'project'),
        NEW.id,
        NEW.project_id,
        NULL
      )
      ON CONFLICT DO NOTHING;

      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS bonus_to_payroll_adj ON bonus_records;
    CREATE TRIGGER bonus_to_payroll_adj
      AFTER INSERT OR UPDATE OF qualified ON bonus_records
      FOR EACH ROW EXECUTE FUNCTION bonus_record_to_payroll_adjustment();
  END IF;
END $$;
