-- Reset AK Renovations onboarding_complete so Adam can experience the wizard
UPDATE companies SET onboarding_complete = false WHERE email = 'akrenovations01@gmail.com';
