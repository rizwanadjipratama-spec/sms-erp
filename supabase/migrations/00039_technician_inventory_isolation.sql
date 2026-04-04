-- ==============================================================================
-- 00039_technician_inventory_isolation.sql
-- Enables strict isolation of Technician-owned inventory from the Warehouse
-- ==============================================================================

-- 1. Add technician_id to the products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_technician ON products(technician_id) WHERE technician_id IS NOT NULL;

-- 2. Update the products_isolation_policy to strictly separate data:
-- - A technician only sees THEIR OWN inventory OR general warehouse inventory
-- - The warehouse ONLY sees general warehouse inventory (technician_id IS NULL)
DROP POLICY IF EXISTS "products_isolation_policy" ON products;
CREATE POLICY "products_isolation_policy" ON products
FOR ALL USING (
    is_executive() 
    OR (
        technician_id IS NOT NULL 
        AND technician_id = auth.uid()
    )
    OR (
        technician_id IS NULL 
        AND (branch_id = get_user_branch_id() OR branch_id IS NULL)
    )
);
