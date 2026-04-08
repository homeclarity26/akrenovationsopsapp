-- Auto-create a profile row whenever a new auth.users row is inserted.
-- This lets people sign up through the live app (via supabase.auth.signUp)
-- and immediately have a corresponding profiles row with a default role.
--
-- Default role is 'client' — the safest choice. Admin must explicitly
-- promote someone to admin or employee via the app or direct SQL.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name, email, is_active)
  VALUES (
    NEW.id,
    'client',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
