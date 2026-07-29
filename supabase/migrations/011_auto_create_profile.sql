-- =====================================================
-- Ciento-Immobilier: Auto-create profile on signup
-- =====================================================
-- This trigger runs when a new user is created in auth.users
-- and automatically creates their profile in public.profiles,
-- bypassing RLS (runs with SECURITY DEFINER).
-- The user_metadata from auth.users is used to populate
-- first_name, last_name, phone, and role.

-- =====================================================
-- 1. Function: handle_new_user
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. Trigger on auth.users
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 3. Update profiles RLS: allow insert only via trigger
--    (remove the per-row insert policy since the trigger
--     handles creation with SECURITY DEFINER)
-- =====================================================
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Users can still update their own profile
-- (existing policy remains)
