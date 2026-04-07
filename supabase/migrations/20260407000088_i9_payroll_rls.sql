-- I9: RLS for all payroll tables — admin only, with employee-self-read exception
-- for payroll_records and payroll_ytd (so employees can see their own paystubs).

-- compensation_components — admin only
ALTER TABLE compensation_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to compensation_components" ON compensation_components;
CREATE POLICY "Admin full access to compensation_components"
  ON compensation_components FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- benefits_enrollment — admin only
ALTER TABLE benefits_enrollment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to benefits_enrollment" ON benefits_enrollment;
CREATE POLICY "Admin full access to benefits_enrollment"
  ON benefits_enrollment FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- pay_periods — admin only
ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to pay_periods" ON pay_periods;
CREATE POLICY "Admin full access to pay_periods"
  ON pay_periods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- payroll_records — admin full access + employee read-own
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to payroll_records" ON payroll_records;
CREATE POLICY "Admin full access to payroll_records"
  ON payroll_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employee read own payroll_records" ON payroll_records;
CREATE POLICY "Employee read own payroll_records"
  ON payroll_records FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
  );

-- payroll_adjustments — admin only
ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to payroll_adjustments" ON payroll_adjustments;
CREATE POLICY "Admin full access to payroll_adjustments"
  ON payroll_adjustments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- mileage_logs — admin full access + employee read/write own
ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to mileage_logs" ON mileage_logs;
CREATE POLICY "Admin full access to mileage_logs"
  ON mileage_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employee manage own mileage_logs" ON mileage_logs;
CREATE POLICY "Employee manage own mileage_logs"
  ON mileage_logs FOR ALL TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
  );

-- payroll_ytd — admin full access + employee read-own
ALTER TABLE payroll_ytd ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to payroll_ytd" ON payroll_ytd;
CREATE POLICY "Admin full access to payroll_ytd"
  ON payroll_ytd FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employee read own payroll_ytd" ON payroll_ytd;
CREATE POLICY "Employee read own payroll_ytd"
  ON payroll_ytd FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
  );
