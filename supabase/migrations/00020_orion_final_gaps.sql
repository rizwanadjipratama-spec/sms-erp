-- ============================================================================
-- ORION ERP: FINAL GAPS MIGRATION
-- Adding new roles, stock transfer statuses, and missing tables
-- ============================================================================

-- 1. ADD NEW ROLES
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'purchasing';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'claim_officer';

-- 2. EXPAND STOCK TRANSFER STATUSES
ALTER TYPE stock_transfer_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE stock_transfer_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE stock_transfer_status ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE stock_transfer_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE stock_transfer_status ADD VALUE IF NOT EXISTS 'completed';

-- 3. STOCK TRANSFER LOGS
CREATE TABLE IF NOT EXISTS stock_transfer_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id     uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  status          stock_transfer_status NOT NULL,
  changed_by      uuid NOT NULL REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_logs_tid ON stock_transfer_logs(transfer_id);

-- 4. CLAIM PAYMENTS
-- Tracks individual payments made against a claim (if partial or full)
CREATE TABLE IF NOT EXISTS claim_payments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id        uuid NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  amount          numeric(15,2) NOT NULL CHECK (amount > 0),
  paid_by         uuid NOT NULL REFERENCES auth.users(id),
  payment_method  text,
  payment_ref     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_payments_cid ON claim_payments(claim_id);

-- 5. SUPPLIER INVOICES
-- Separate from PO to track incoming supplier bills
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id   uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id),
  branch_id           uuid NOT NULL REFERENCES branches(id),
  invoice_number      text NOT NULL UNIQUE,
  total_amount        numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount          numeric(15,2) NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid, cancelled
  due_date            timestamptz,
  paid_amount         numeric(15,2) NOT NULL DEFAULT 0,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supp_inv_po ON supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supp_inv_sup ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supp_inv_branch ON supplier_invoices(branch_id);

DROP TRIGGER IF EXISTS trg_supplier_invoices_updated_at ON supplier_invoices;
CREATE TRIGGER trg_supplier_invoices_updated_at BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
