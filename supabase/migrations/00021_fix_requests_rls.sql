-- ============================================================================
-- Patch RLS policies to include new enterprise roles AND fix visibility constraints
-- ============================================================================

DO $$
BEGIN
  -- 1. REQUESTS UPDATE
  -- We include ALL roles except client. WITH CHECK handles the new row explicit evaluation
  DROP POLICY IF EXISTS "requests_update" ON requests;
  CREATE POLICY "requests_update" ON requests FOR UPDATE USING (
    user_id = auth.uid()
    OR auth_user_role() IN ('marketing','boss','finance','warehouse','technician','admin','owner','faktur','tax','manager','purchasing','claim_officer','director')
  ) WITH CHECK (
    user_id = auth.uid()
    OR auth_user_role() IN ('marketing','boss','finance','warehouse','technician','admin','owner','faktur','tax','manager','purchasing','claim_officer','director')
  );

  -- 2. REQUESTS SELECT
  -- Allow marketing and others to still see requests even after they are advanced (vital for the RETURNING clause)
  DROP POLICY IF EXISTS "requests_select" ON requests;
  CREATE POLICY "requests_select" ON requests FOR SELECT USING (
    user_id = auth.uid()
    OR auth_user_role() IN ('marketing','boss','finance','warehouse','technician','courier','admin','owner','faktur','tax','manager','purchasing','claim_officer','director')
  );

  -- 3. REQUEST ITEMS UPDATE
  DROP POLICY IF EXISTS "request_items_update" ON request_items;
  CREATE POLICY "request_items_update" ON request_items FOR UPDATE USING (
    auth_user_role() IN ('marketing','boss','finance','admin','owner','faktur','tax','manager','purchasing','claim_officer','director')
  );

  -- 4. INVOICES INSERT
  DROP POLICY IF EXISTS "invoices_insert" ON invoices;
  CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (
    auth_user_role() IN ('finance','boss','admin','owner','faktur','tax','manager','director')
  );

  -- 5. INVOICES UPDATE
  DROP POLICY IF EXISTS "invoices_update" ON invoices;
  CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (
    auth_user_role() IN ('finance','boss','admin','owner','faktur','tax','manager','director')
  );

END $$;
