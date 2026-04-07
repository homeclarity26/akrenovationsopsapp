-- I10: Seed 26 bi-weekly pay periods for 2026
-- Pay date: every other Friday. Period 1 ends Friday Jan 9, 2026.
-- Period covers prior 14 days ending on the pay date Friday.

DO $$
DECLARE
  base_pay_date DATE := DATE '2026-01-09';  -- First Friday pay date of 2026
  i INTEGER;
  cur_pay_date DATE;
  cur_period_end DATE;
  cur_period_start DATE;
  cur_status TEXT;
  today DATE := CURRENT_DATE;
BEGIN
  FOR i IN 1..26 LOOP
    cur_pay_date := base_pay_date + ((i - 1) * 14);
    cur_period_end := cur_pay_date;       -- period ends on the pay date Friday
    cur_period_start := cur_pay_date - 13; -- 14-day period

    IF today > cur_period_end THEN
      cur_status := 'closed';
    ELSIF today BETWEEN cur_period_start AND cur_period_end THEN
      cur_status := 'open';
    ELSE
      cur_status := 'upcoming';
    END IF;

    INSERT INTO pay_periods (period_start, period_end, pay_date, period_number, year, status)
    VALUES (cur_period_start, cur_period_end, cur_pay_date, i, 2026, cur_status)
    ON CONFLICT (period_start, period_end) DO NOTHING;
  END LOOP;
END $$;
