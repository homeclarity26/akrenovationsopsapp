-- F5: Migrate data from time_entries_legacy into new time_entries

INSERT INTO time_entries (
  id,
  user_id,
  project_id,
  work_type,
  clock_in,
  clock_out,
  total_minutes,
  is_billable,
  entry_method,
  clock_in_lat,
  clock_in_lng,
  clock_out_lat,
  clock_out_lng,
  geofence_verified,
  notes,
  created_at,
  updated_at
)
SELECT
  id,
  employee_id,                            -- old column name
  project_id,
  'field_carpentry',                      -- best guess for all legacy data
  clock_in,
  clock_out,
  CASE
    WHEN clock_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (clock_out - clock_in))::INTEGER / 60
    ELSE NULL
  END,
  true,                                   -- assume billable
  COALESCE(entry_type, 'live'),           -- entry_type → entry_method
  clock_in_lat,
  clock_in_lng,
  clock_out_lat,
  clock_out_lng,
  geofence_verified,
  notes,
  created_at,
  updated_at
FROM time_entries_legacy
-- Skip any open entries that would violate the unique constraint (keep only most recent open per user)
WHERE id IN (
  -- Keep all closed entries
  SELECT id FROM time_entries_legacy WHERE clock_out IS NOT NULL
  UNION ALL
  -- Keep only the most recent open entry per employee (window function in a subquery
  -- avoids the UNION-ORDER-BY gotcha where the outer UNION rejects ORDER BY on a
  -- non-selected column)
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY clock_in DESC) AS rn
    FROM time_entries_legacy
    WHERE clock_out IS NULL
  ) ranked
  WHERE rn = 1
);
