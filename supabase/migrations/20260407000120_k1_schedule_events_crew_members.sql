-- K1: Add crew_members column to schedule_events for crew board view
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS
  crew_members UUID[] DEFAULT '{}';
