-- F6: RLS for new time_entries and work_type_rates tables

-- time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own time entries" ON time_entries
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users insert own time entries" ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own open entries or admin updates any" ON time_entries
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND clock_out IS NULL)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- work_type_rates: users see own rates; admin sees and manages all
ALTER TABLE work_type_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own rates" ON work_type_rates
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin manages all rates" ON work_type_rates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- profiles: users can update their own field_mode columns
CREATE POLICY "Users update own field mode" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
