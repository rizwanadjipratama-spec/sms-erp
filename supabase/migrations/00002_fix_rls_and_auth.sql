-- ============================================================================
-- FIX: Clean RLS policies + Auth trigger
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. DROP ALL EXISTING POLICIES ON PROFILES (clean slate)
-- ============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles;', pol.policyname);
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE EXACTLY 4 CLEAN PERMISSIVE POLICIES
-- ============================================================================

-- Users can read own profile; admin/owner can read all; marketing can read clients
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
  OR (has_role('marketing') AND role::user_role = 'client')
);

-- Users can update own profile
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin/owner can update any profile
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- Authenticated users can insert their own profile
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- 3. FIX HANDLE_NEW_USER TRIGGER (production-grade)
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'client'::user_role,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 4. FIX ACTIVITY_LOGS POLICIES (used during login)
-- ============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'activity_logs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON activity_logs;', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_logs_select ON activity_logs FOR SELECT USING (
  user_id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
);

CREATE POLICY activity_logs_insert ON activity_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 5. VERIFY — run this to confirm policies are correct
-- ============================================================================
SELECT tablename, policyname, cmd, permissive, qual, with_check
FROM pg_policies
WHERE tablename IN ('profiles', 'activity_logs')
ORDER BY tablename, policyname;
