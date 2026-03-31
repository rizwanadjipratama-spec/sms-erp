-- ==============================================================================
-- EPIC: MULTI-BRANCH DATA SEGREGATION
-- This super-migration adds `branch_id` to all operational tables and enforces
-- strict Row-Level Security (RLS) to prevent cross-branch data bleeding.
-- ==============================================================================

-- 1. Add branch_id to all operational tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE payment_promises ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Handle service_issues if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_issues') THEN
        ALTER TABLE service_issues ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 2. Create helper function for RLS to make policies extremely fast and avoid deep joins
CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_executive()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'owner', 'boss', 'director');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Apply Strict RLS Policies
-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_isolation_policy" ON products;
CREATE POLICY "products_isolation_policy" ON products
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
    OR branch_id IS NULL -- Allow viewing legacy generic items until assigned
);

-- REQUESTS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "requests_isolation_policy" ON requests;
CREATE POLICY "requests_isolation_policy" ON requests
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
    OR branch_id IS NULL
    OR user_id = auth.uid() -- Client can always see their own request regardless of branch
);

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_isolation_policy" ON invoices;
CREATE POLICY "invoices_isolation_policy" ON invoices
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
    OR branch_id IS NULL
);

-- PAYMENT PROMISES
ALTER TABLE payment_promises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_promises_isolation_policy" ON payment_promises;
CREATE POLICY "payment_promises_isolation_policy" ON payment_promises
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
    OR branch_id IS NULL
    OR user_id = auth.uid()
);

-- ISSUES
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "issues_isolation_policy" ON issues;
CREATE POLICY "issues_isolation_policy" ON issues
FOR ALL USING (
    is_executive() 
    OR branch_id = get_user_branch_id()
    OR branch_id IS NULL
    OR reported_by = auth.uid()
);

-- SERVICE ISSUES
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_issues') THEN
        -- Safely drop and create policy for service_issues
        EXECUTE 'ALTER TABLE service_issues ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "service_issues_isolation_policy" ON service_issues';
        EXECUTE 'CREATE POLICY "service_issues_isolation_policy" ON service_issues FOR ALL USING (
            is_executive() 
            OR branch_id = get_user_branch_id()
            OR branch_id IS NULL
            OR reported_by = auth.uid()
        )';
    END IF;
END $$;

-- 4. Automatically index branch_id for performance since every query will filter by it
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_requests_branch ON requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_promises_branch ON payment_promises(branch_id);
CREATE INDEX IF NOT EXISTS idx_issues_branch ON issues(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);
