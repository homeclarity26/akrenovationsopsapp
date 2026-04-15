-- Add three-level onboarding tracking columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS platform_onboarding_complete boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_onboarding_complete boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS field_onboarding_complete boolean DEFAULT false;

-- Reset ALL onboarding flags for Adam so he gets fresh onboarding on next login
UPDATE profiles SET
  platform_onboarding_complete = false,
  company_onboarding_complete = false,
  field_onboarding_complete = false
WHERE id = '8d4c129e-cdff-4f0a-90d8-ab81eafe2086';

-- Also reset company onboarding so Adam goes through the full flow
UPDATE companies SET onboarding_complete = false
WHERE id = (SELECT company_id FROM profiles WHERE id = '8d4c129e-cdff-4f0a-90d8-ab81eafe2086');
