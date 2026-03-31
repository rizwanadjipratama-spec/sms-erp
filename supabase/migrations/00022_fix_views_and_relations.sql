-- ============================================================================
-- Fix Missing Grants for Branches and Analytics Views
-- Fix Foreign Keys on delivery_logs for PostgREST joins
-- ============================================================================

DO $$
BEGIN
  -- 1. GRANTS FOR BRANCHES & REGIONS
  GRANT SELECT ON branches TO authenticated, anon;
  GRANT SELECT ON regions TO authenticated, anon;

  -- 2. GRANTS FOR ANALYTICS VIEWS
  GRANT SELECT ON v_monthly_revenue TO authenticated, anon;
  GRANT SELECT ON v_order_pipeline TO authenticated, anon;
  GRANT SELECT ON v_product_performance TO authenticated, anon;
  GRANT SELECT ON v_technician_performance TO authenticated, anon;

  -- 3. FIX FOREIGN KEYS ON delivery_logs
  -- Drop existing foreign keys that point to auth.users
  BEGIN
    ALTER TABLE delivery_logs DROP CONSTRAINT IF EXISTS delivery_logs_technician_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  
  BEGIN
    ALTER TABLE delivery_logs DROP CONSTRAINT IF EXISTS delivery_logs_courier_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Add constraints pointing to profiles(id)
  -- This allows PostgREST to properly join profiles on queries like courier:profiles(...)
  BEGIN
    ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES profiles(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TABLE delivery_logs ADD CONSTRAINT delivery_logs_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES profiles(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- Ensure branches table has RLS policy (if RLS is enabled on it, we need a select policy)
  -- If RLS is enabled without a policy, the GRANT is useless.
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'branches' AND relrowsecurity = true) THEN
    DROP POLICY IF EXISTS "branches_select" ON branches;
    CREATE POLICY "branches_select" ON branches FOR SELECT USING (true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'regions' AND relrowsecurity = true) THEN
    DROP POLICY IF EXISTS "regions_select" ON regions;
    CREATE POLICY "regions_select" ON regions FOR SELECT USING (true);
  END IF;

END $$;
