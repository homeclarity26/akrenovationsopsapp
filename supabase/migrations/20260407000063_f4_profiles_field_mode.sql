-- F4: Add field mode columns to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS field_mode_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_mode_default_work_type TEXT NOT NULL DEFAULT 'field_carpentry';
