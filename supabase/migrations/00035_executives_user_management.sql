-- ============================================================================
-- 00035_executives_user_management.sql
-- Description: Fix User Management for Executives (Boss, Director, Manager, Owner)
-- by giving them proper RLS UPDATE permissions on the profiles table.
-- ============================================================================

DO $$
BEGIN
    -- Drop previous conflicting policies
    DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
    DROP POLICY IF EXISTS "Supervisors can update profiles" ON profiles;
    
    -- Create the new unified policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'profiles_executive_update'
    ) THEN
        CREATE POLICY "profiles_executive_update" ON profiles
            FOR UPDATE 
            USING (
                has_any_role(ARRAY['admin', 'owner', 'boss', 'director', 'manager']::user_role[])
            );
    END IF;
END $$;
