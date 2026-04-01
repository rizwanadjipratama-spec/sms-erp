-- ==============================================================================
-- PHASE 1: DATABASE HARDENING
-- ==============================================================================

-- 1. Create strict ENUM for inventory movement
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
        CREATE TYPE inventory_movement_type AS ENUM (
            'PURCHASE_IN', 'SALES_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'STOCK_OPNAME', 'RETURN', 'SERVICE_PART'
        );
    END IF;
END $$;

-- 2. Add movement_type to inventory_logs
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS movement_type inventory_movement_type;

-- Retroactively set legacy logs
UPDATE inventory_logs 
SET movement_type = CASE
    WHEN change > 0 THEN 'ADJUSTMENT'::inventory_movement_type
    ELSE 'SALES_OUT'::inventory_movement_type
END
WHERE movement_type IS NULL;

-- Enforce NOT NULL for future movements
ALTER TABLE inventory_logs ALTER COLUMN movement_type SET NOT NULL;

-- 3. Add CHECK constraints to prevent negative stock
-- Fix any existing negative stock first to avoid constraint violation
UPDATE products SET stock = 0 WHERE stock < 0;
UPDATE product_branch_stock SET stock = 0 WHERE stock < 0;

ALTER TABLE products DROP CONSTRAINT IF EXISTS check_products_stock_positive;
ALTER TABLE products ADD CONSTRAINT check_products_stock_positive CHECK (stock >= 0);

ALTER TABLE product_branch_stock DROP CONSTRAINT IF EXISTS check_pbs_stock_positive;
ALTER TABLE product_branch_stock ADD CONSTRAINT check_pbs_stock_positive CHECK (stock >= 0);

-- 4. Create audit_logs table for tracking critical changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);

-- 5. Ensure all transactional tables have branch_id (Catching missing ones from early Orion migrations)
-- Using IF EXISTS blocks because some of these tables might be newer or named differently
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_requests') THEN
        ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_orders') THEN
        ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expense_claims') THEN
        ALTER TABLE expense_claims ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_advances') THEN
        ALTER TABLE cash_advances ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_transactions') THEN
        ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    END IF;
END $$;
