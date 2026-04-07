-- F1: Rename existing time_entries to time_entries_legacy to preserve data
-- New time_entries table will be created in the next migration

ALTER TABLE IF EXISTS time_entries RENAME TO time_entries_legacy;
