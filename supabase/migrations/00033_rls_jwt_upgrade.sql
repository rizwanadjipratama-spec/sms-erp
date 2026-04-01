-- ==============================================================================
-- PHASE 8: RLS SECURITY (JWT METADATA STABILIZATION)
-- ==============================================================================
-- Upgrading the RLS helper functions from 00028 to extract role and branch_id
-- directly from the Supabase JWT `auth.jwt() -> 'app_metadata'`.
-- This eliminates recursive profile lookups and guarantees O(1) performance
-- forRow-Level Security checks across thousands of rows.

CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    -- Primary: Instant O(1) JWT extraction
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'branch_id', '')::UUID,
    -- Fallback: Profile lookup if JWT is stale
    (SELECT branch_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (SELECT role::TEXT FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_executive()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner', 'boss', 'director'),
    (SELECT role::TEXT IN ('admin', 'owner', 'boss', 'director') FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Apply RLS to the new price_lists architecture we generated in Phase 6
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_lists_isolation_policy" ON price_lists;
CREATE POLICY "price_lists_isolation_policy" ON price_lists
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
    OR branch_id IS NULL -- Global price lists
);

ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_list_items_isolation_policy" ON price_list_items;
-- Items belong to lists, which belong to branches.
-- Note: Subqueries in RLS bypass can be slightly slower, but since price_list_items
-- changes infrequently and is heavily cached on the frontend, it is acceptable.
CREATE POLICY "price_list_items_isolation_policy" ON price_list_items
FOR ALL USING (
    is_executive() 
    OR (SELECT branch_id FROM price_lists WHERE id = price_list_id) = get_user_branch_id()
    OR (SELECT branch_id FROM price_lists WHERE id = price_list_id) IS NULL
);

-- Apply RLS to the financial_transactions table
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_transactions_isolation_policy" ON financial_transactions;
CREATE POLICY "financial_transactions_isolation_policy" ON financial_transactions
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
);
