-- Seed AK Renovations as Company #1 and link Adam's super_admin profile.
--
-- Adam is the platform owner (super_admin) AND runs AK Renovations.
-- We keep his role as super_admin (highest privilege) and set company_id on
-- his profile so he's linked to Company #1.  The frontend "Enter as Admin"
-- button on the platform company-detail page lets him switch into the
-- company admin view without needing a second role row.

-- 1. Insert AK Renovations company
INSERT INTO companies (
  name,
  phone,
  email,
  street,
  city,
  state,
  zip,
  website,
  services_offered,
  onboarding_complete,
  timezone
)
VALUES (
  'AK Renovations',
  NULL,  -- Adam will fill in
  'akrenovations01@gmail.com',
  NULL,
  'Akron',
  'OH',
  NULL,
  'https://akrenovationsohio.com',
  '["Kitchen Remodeling", "Bathroom Remodeling", "First Floor Remodeling", "Basement Finishing"]'::jsonb,
  true,
  'America/New_York'
)
ON CONFLICT DO NOTHING;

-- 2. Link Adam's profile to AK Renovations.
--    His profile was created by the auth trigger when he signed up.
--    This UPDATE sets company_id so he's associated with AK Renovations
--    while keeping super_admin role for platform access.
UPDATE profiles
SET company_id = (SELECT id FROM companies WHERE email = 'akrenovations01@gmail.com' LIMIT 1)
WHERE email = 'akrenovations01@gmail.com'
  AND role = 'super_admin';
