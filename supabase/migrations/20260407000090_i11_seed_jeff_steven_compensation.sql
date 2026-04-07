-- I11 + I12: Seed Jeff and Steven payroll setup, compensation components, and benefits
-- Lookups by full_name. No-op if profiles don't exist yet.

DO $$
DECLARE
  jeff_id UUID;
  steven_id UUID;
BEGIN
  SELECT id INTO jeff_id FROM profiles WHERE full_name ILIKE 'Jeff%' AND role = 'employee' LIMIT 1;
  SELECT id INTO steven_id FROM profiles WHERE full_name ILIKE 'Steven%' AND role = 'employee' LIMIT 1;

  -- Jeff: $80,000 salary, full-time, OT eligible no (salaried), vehicle $300/mo, retirement employer $3,500/yr
  IF jeff_id IS NOT NULL THEN
    UPDATE profiles SET
      worker_type = 'w2_fulltime',
      pay_type = 'salary',
      annual_salary = 80000,
      standard_hours_per_week = 40,
      overtime_eligible = false,
      hire_date = COALESCE(hire_date, DATE '2023-03-01'),
      pay_frequency = 'biweekly',
      filing_status = COALESCE(filing_status, 'married_jointly'),
      suta_rate = COALESCE(suta_rate, 0.027)
    WHERE id = jeff_id;

    DELETE FROM compensation_components WHERE profile_id = jeff_id;
    INSERT INTO compensation_components (profile_id, component_type, amount, amount_frequency, is_taxable, is_pre_tax, notes) VALUES
      (jeff_id, 'base_salary',         80000,    'annual',     true, false, 'Annual base salary'),
      (jeff_id, 'vehicle_allowance',   300,      'monthly',    true, false, 'Fixed vehicle allowance — taxable per IRS'),
      (jeff_id, 'retirement_employer', 3500,     'annual',     false, false, 'Flat $3,500/year SIMPLE IRA employer contribution');

    DELETE FROM benefits_enrollment WHERE profile_id = jeff_id;
    INSERT INTO benefits_enrollment (
      profile_id, benefit_type, plan_name, carrier,
      employee_contribution_amount, employee_contribution_frequency,
      employer_contribution_amount, employer_contribution_frequency,
      is_pre_tax, is_active
    ) VALUES (
      jeff_id, 'retirement_simple_ira', 'AK Renovations SIMPLE IRA', 'TBD',
      0, 'percent_of_gross',
      3500, 'annual',
      true, true
    );
  END IF;

  -- Steven: $56,000 salary, full-time, vehicle $300/mo, health employer $200/mo
  IF steven_id IS NOT NULL THEN
    UPDATE profiles SET
      worker_type = 'w2_fulltime',
      pay_type = 'salary',
      annual_salary = 56000,
      standard_hours_per_week = 40,
      overtime_eligible = false,
      hire_date = COALESCE(hire_date, DATE '2023-06-01'),
      pay_frequency = 'biweekly',
      filing_status = COALESCE(filing_status, 'single'),
      suta_rate = COALESCE(suta_rate, 0.027)
    WHERE id = steven_id;

    DELETE FROM compensation_components WHERE profile_id = steven_id;
    INSERT INTO compensation_components (profile_id, component_type, amount, amount_frequency, is_taxable, is_pre_tax, notes) VALUES
      (steven_id, 'base_salary',       56000, 'annual',  true, false, 'Annual base salary'),
      (steven_id, 'vehicle_allowance', 300,   'monthly', true, false, 'Fixed vehicle allowance — taxable per IRS'),
      (steven_id, 'health_employer',   200,   'monthly', false, false, 'Employer health insurance contribution');

    DELETE FROM benefits_enrollment WHERE profile_id = steven_id;
    INSERT INTO benefits_enrollment (
      profile_id, benefit_type, plan_name, carrier,
      employee_contribution_amount, employee_contribution_frequency,
      employer_contribution_amount, employer_contribution_frequency,
      is_pre_tax, is_active
    ) VALUES (
      steven_id, 'health', 'Anthem Bronze HSA', 'Anthem',
      200, 'monthly',
      200, 'monthly',
      true, true
    );
  END IF;
END $$;
