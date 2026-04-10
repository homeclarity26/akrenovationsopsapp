-- ============================================================================
-- Client Onboarding — add onboarding fields to profiles
-- ============================================================================
-- Adds columns used by the client onboarding wizard to track completion
-- status and homeowner contact preferences.
-- ============================================================================

-- Onboarding flag (true after wizard completed)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Homeowner contact preferences (set during onboarding step 2)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_contact TEXT
  CHECK (preferred_contact IS NULL OR preferred_contact IN ('email', 'text', 'phone'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_time TEXT
  CHECK (preferred_time IS NULL OR preferred_time IN ('morning', 'afternoon', 'evening', 'anytime'));
