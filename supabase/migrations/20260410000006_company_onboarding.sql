-- Company onboarding: extend companies table with onboarding fields
-- and create company-assets storage bucket for logos/photos.

-- New columns on companies for the onboarding wizard
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Business details
ALTER TABLE companies ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '[]';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS service_area TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS insurance_info TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS years_in_business INTEGER;

-- Preferences
ALTER TABLE companies ADD COLUMN IF NOT EXISTS preferred_communication TEXT DEFAULT 'email';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Onboarding state
ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Owner profile photo on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- RLS: company admins can update their own company
CREATE POLICY IF NOT EXISTS "Admins can update own company"
  ON companies FOR UPDATE
  USING (
    id IN (SELECT company_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Storage bucket for company assets (logos, profile photos)
-- NOTE: Bucket creation requires Supabase CLI or Dashboard:
--   supabase storage buckets create company-assets --private
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/svg+xml
