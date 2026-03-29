-- ============================================================================
-- 00007 CHAT FIXES: CHANNEL CREATION & PROFILE VISIBILITY
-- Run this in your Supabase SQL Editor!
-- ============================================================================

-- ============================================================================
-- 1. FIX "ERROR CREATING CHANNEL" (Drop Unique Constraint)
-- ============================================================================
-- The original schema had a UNIQUE index on channel_type, which prevented
-- users from creating multiple channels of the same category (e.g., two Marketing channels).
-- By dropping this, Admin/Owner can create unlimited channels!
DROP INDEX IF EXISTS idx_chat_channels_type;

-- Also remove the unique constraint if it was created as a constraint instead of an index
ALTER TABLE chat_channels DROP CONSTRAINT IF EXISTS chat_channels_channel_type_key;

-- ============================================================================
-- 2. FIX PROFILE VISIBILITY (Names in Chat)
-- ============================================================================
-- Explicitly cast roles to the user_role enum to avoid Postgres parse errors.
-- This ensures the policy applies successfully and employees can see each other's names.
DROP POLICY IF EXISTS profiles_select ON profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  -- 1. Users can always read their own profile
  id = auth.uid()
  
  -- 2. Admins and Owners can read everything
  OR has_any_role(ARRAY['admin'::user_role, 'owner'::user_role])
  
  -- 3. Any employee can read any other employee's profile
  OR (
    has_any_role(ARRAY['marketing'::user_role, 'finance'::user_role, 'warehouse'::user_role, 'technician'::user_role, 'boss'::user_role, 'tax'::user_role]) 
    AND role != 'client'::user_role
  )
  
  -- 4. Marketing can also read clients
  OR (has_role('marketing'::user_role) AND role = 'client'::user_role)
);
