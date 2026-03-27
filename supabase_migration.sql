-- ============================================================
-- COMPANY OS — SUPABASE MIGRATION
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- 1. EXTEND PROFILES TABLE
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS pic_name TEXT;

-- Allow all 9 roles (role column is already TEXT)
-- Valid values: client, marketing, boss, finance, warehouse, technician, admin, owner, tax, user

-- ============================================================
-- 2. EXTEND REQUESTS TABLE
-- ============================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS price_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS marketing_note TEXT,
  ADD COLUMN IF NOT EXISTS assigned_technician_id UUID;

-- ============================================================
-- 3. PRICE LIST TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS price_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_regular NUMERIC NOT NULL DEFAULT 0,
  price_kso NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- ============================================================
-- 4. INVOICES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  issued_by TEXT,
  due_date DATE,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. DELIVERY LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  technician_id UUID,
  proof_url TEXT,
  signature_url TEXT,
  note TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. INVENTORY LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  change INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  by_user TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info | success | warning | error
  read BOOLEAN NOT NULL DEFAULT FALSE,
  order_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_read ON notifications(user_id, read);

-- ============================================================
-- 8. ACTIVITY LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS activity_logs_entity ON activity_logs(entity_type, entity_id);

-- ============================================================
-- 9. ISSUES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | in_progress | resolved
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. MONTHLY CLOSING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_closing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  paid_invoices INTEGER DEFAULT 0,
  unpaid_invoices INTEGER DEFAULT 0,
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closing ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read price_list
CREATE POLICY "price_list_read" ON price_list FOR SELECT TO authenticated USING (true);
-- Only marketing/admin/owner can write price_list (enforced at app level)
CREATE POLICY "price_list_write" ON price_list FOR ALL TO authenticated USING (true);

-- Users can see their own notifications
CREATE POLICY "notifications_own" ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Invoices: authenticated can read/write (app-level role check)
CREATE POLICY "invoices_all" ON invoices FOR ALL TO authenticated USING (true);

-- Delivery logs: authenticated can read/write
CREATE POLICY "delivery_logs_all" ON delivery_logs FOR ALL TO authenticated USING (true);

-- Inventory logs: authenticated can read/write
CREATE POLICY "inventory_logs_all" ON inventory_logs FOR ALL TO authenticated USING (true);

-- Activity logs: authenticated can insert
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
-- Admin/owner read all (app-level enforced)
CREATE POLICY "activity_logs_read" ON activity_logs FOR SELECT TO authenticated USING (true);

-- Issues: authenticated
CREATE POLICY "issues_all" ON issues FOR ALL TO authenticated USING (true);

-- Monthly closing: authenticated
CREATE POLICY "monthly_closing_all" ON monthly_closing FOR ALL TO authenticated USING (true);

-- ============================================================
-- 12. HELPER FUNCTION: DECREMENT STOCK
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET
    stock = GREATEST(0, stock - p_qty),
    status = CASE WHEN GREATEST(0, stock - p_qty) = 0 THEN 'out_of_stock' ELSE 'in_stock' END
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DONE — Run this script once in Supabase SQL Editor
-- Then set roles for existing users in the profiles table
-- ============================================================
