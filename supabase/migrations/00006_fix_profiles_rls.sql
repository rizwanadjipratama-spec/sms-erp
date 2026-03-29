-- ============================================================================
-- SUPER ADVANCED CHAT PANEL UPGRADE - PROFILES FIX
-- Fixes RLS on profiles so non-admin employees can see who sent chat messages
-- ============================================================================

-- Drop the overly restrictive profiles_select policy
DROP POLICY IF EXISTS profiles_select ON profiles;

-- Create a new, correct policy for an internal ERP
-- 1. Users can always read their own profile
-- 2. Admins and Owners can read everything
-- 3. Any employee (marketing, finance, warehouse, technician, boss, tax) can read any other employee's profile
-- 4. Marketing can also read clients
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
  OR (
    has_any_role(ARRAY['marketing','finance','warehouse','technician','boss','tax']::user_role[]) 
    AND role::text != 'client'
  )
  OR (has_role('marketing') AND role::text = 'client')
);
