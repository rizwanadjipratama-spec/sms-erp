-- ============================================================================
-- ORION ERP: COMBINED MIGRATION
-- Region/Branch System + Product Stock + Purchasing + Claims + Approvals + Finance
-- Run this SINGLE file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART A: REGION & BRANCH SYSTEM (from 00018)
-- ============================================================================

-- A1. REGIONS
CREATE TABLE IF NOT EXISTS regions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL UNIQUE,
  code        text NOT NULL UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- A2. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id   uuid NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  name        text NOT NULL,
  code        text NOT NULL UNIQUE,
  address     text,
  phone       text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_region ON branches(region_id);

-- A3. ADD branch_id TO PROFILES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'branch_id') THEN
    ALTER TABLE profiles ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_completed') THEN
    ALTER TABLE profiles ADD COLUMN profile_completed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'city') THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'province') THEN
    ALTER TABLE profiles ADD COLUMN province text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id) WHERE branch_id IS NOT NULL;

-- A4. ADD branch_id TO REQUESTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'branch_id') THEN
    ALTER TABLE requests ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_branch ON requests(branch_id) WHERE branch_id IS NOT NULL;

-- A5. ADD branch_id TO PRODUCTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'branch_id') THEN
    ALTER TABLE products ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id) WHERE branch_id IS NOT NULL;

-- A6. ADD branch_id TO DELIVERY_LOGS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_logs' AND column_name = 'branch_id') THEN
    ALTER TABLE delivery_logs ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

-- A7. ADD branch_id TO INVOICES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'branch_id') THEN
    ALTER TABLE invoices ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

-- A8. ADD branch_id TO ISSUES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'branch_id') THEN
    ALTER TABLE issues ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

-- A9. ADD branch_id TO ACTIVITY_LOGS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'branch_id') THEN
    ALTER TABLE activity_logs ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

-- A10. ADD branch_id TO INVENTORY_LOGS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_logs' AND column_name = 'branch_id') THEN
    ALTER TABLE inventory_logs ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

-- A11. SEED: Default Region & Branches
INSERT INTO regions (name, code, sort_order)
VALUES ('Indonesia', 'ID', 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO branches (region_id, name, code, sort_order)
VALUES
  ((SELECT id FROM regions WHERE code = 'ID'), 'Bogor',       'BGR', 1),
  ((SELECT id FROM regions WHERE code = 'ID'), 'Purwokerto',  'PWK', 2),
  ((SELECT id FROM regions WHERE code = 'ID'), 'Cirebon',     'CRB', 3)
ON CONFLICT (code) DO NOTHING;

-- A12. ADD price_cost_per_test TO PRICE_LIST
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'price_cost_per_test') THEN
    ALTER TABLE price_list ADD COLUMN price_cost_per_test numeric(15,2) NOT NULL DEFAULT 0 CHECK (price_cost_per_test >= 0);
  END IF;
END $$;

-- A13. TRIGGERS for regions/branches
DROP TRIGGER IF EXISTS trg_regions_updated_at ON regions;
CREATE TRIGGER trg_regions_updated_at BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- A14. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION auth_user_branch_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT branch_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_global_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role::user_role = ANY(ARRAY['owner','admin']::user_role[])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART B: BUSINESS SYSTEMS (from 00019)
-- ============================================================================

-- B1. PRODUCT BRANCH STOCK
CREATE TABLE IF NOT EXISTS product_branch_stock (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  stock       integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock   integer NOT NULL DEFAULT 5,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_pbs_product ON product_branch_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_pbs_branch ON product_branch_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_pbs_low_stock ON product_branch_stock(branch_id) WHERE stock <= min_stock;

-- B2. STOCK TRANSFERS
DO $$ BEGIN
  CREATE TYPE stock_transfer_status AS ENUM ('requested','approved','in_transit','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stock_transfers (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id    uuid NOT NULL REFERENCES branches(id),
  to_branch_id      uuid NOT NULL REFERENCES branches(id),
  status            stock_transfer_status NOT NULL DEFAULT 'requested',
  notes             text,
  requested_by      uuid NOT NULL REFERENCES auth.users(id),
  approved_by       uuid REFERENCES auth.users(id),
  approved_at       timestamptz,
  received_by       uuid REFERENCES auth.users(id),
  received_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (from_branch_id <> to_branch_id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id       uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id),
  quantity          integer NOT NULL CHECK (quantity > 0),
  received_quantity integer DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to ON stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id);

-- B3. BRANCH-SPECIFIC PRICING
CREATE TABLE IF NOT EXISTS branch_price_overrides (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  price_regular       numeric(15,2),
  price_kso           numeric(15,2),
  price_cost_per_test numeric(15,2),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

-- B4. APPROVAL SYSTEM
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_type AS ENUM (
    'expense_claim','purchase_request','cash_advance','discount',
    'stock_transfer','branch_override','maintenance_cost','large_purchase'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS approvals (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_type   approval_type NOT NULL,
  reference_id    uuid NOT NULL,
  reference_table text NOT NULL,
  title           text NOT NULL,
  description     text,
  amount          numeric(15,2),
  branch_id       uuid REFERENCES branches(id),
  requested_by    uuid NOT NULL REFERENCES auth.users(id),
  status          approval_status NOT NULL DEFAULT 'pending',
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  rejection_reason text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_type ON approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_ref ON approvals(reference_id, reference_table);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_approvals_branch ON approvals(branch_id);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approvals(status, created_at DESC) WHERE status = 'pending';

-- B5. PURCHASING SYSTEM
DO $$ BEGIN
  CREATE TYPE purchase_request_status AS ENUM ('draft','submitted','approved','ordered','partial_received','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE purchase_order_status AS ENUM ('draft','sent','confirmed','partial_received','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS suppliers (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  contact     text,
  email       text,
  phone       text,
  address     text,
  notes       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       uuid NOT NULL REFERENCES branches(id),
  requested_by    uuid NOT NULL REFERENCES auth.users(id),
  status          purchase_request_status NOT NULL DEFAULT 'draft',
  title           text NOT NULL,
  notes           text,
  total_estimated numeric(15,2) NOT NULL DEFAULT 0,
  approval_id     uuid REFERENCES approvals(id),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_request_id uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  product_id          uuid REFERENCES products(id),
  item_name           text NOT NULL,
  quantity            integer NOT NULL CHECK (quantity > 0),
  unit                text NOT NULL DEFAULT 'pcs',
  estimated_price     numeric(15,2) NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_request_id uuid REFERENCES purchase_requests(id),
  branch_id           uuid NOT NULL REFERENCES branches(id),
  supplier_id         uuid NOT NULL REFERENCES suppliers(id),
  po_number           text NOT NULL UNIQUE,
  status              purchase_order_status NOT NULL DEFAULT 'draft',
  total               numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount          numeric(15,2) NOT NULL DEFAULT 0,
  notes               text,
  ordered_at          timestamptz,
  received_at         timestamptz,
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        uuid REFERENCES products(id),
  item_name         text NOT NULL,
  quantity          integer NOT NULL CHECK (quantity > 0),
  received_quantity integer NOT NULL DEFAULT 0,
  unit_price        numeric(15,2) NOT NULL DEFAULT 0,
  total_price       numeric(15,2) NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_branch ON purchase_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);

-- B6. EXPENSE CLAIMS
DO $$ BEGIN
  CREATE TYPE expense_claim_status AS ENUM ('draft','submitted','approved','paid','partial_paid','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'fuel','toll','parking','small_tools','sparepart','hotel',
    'meals','vehicle_service','operational','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS expense_claims (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       uuid NOT NULL REFERENCES branches(id),
  claimant_id     uuid NOT NULL REFERENCES auth.users(id),
  status          expense_claim_status NOT NULL DEFAULT 'draft',
  category        expense_category NOT NULL DEFAULT 'operational',
  title           text NOT NULL,
  description     text,
  amount          numeric(15,2) NOT NULL CHECK (amount > 0),
  receipt_url     text,
  approval_id     uuid REFERENCES approvals(id),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  paid_amount     numeric(15,2) NOT NULL DEFAULT 0,
  paid_at         timestamptz,
  paid_by         uuid REFERENCES auth.users(id),
  rejection_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_claims_branch ON expense_claims(branch_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_claimant ON expense_claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_category ON expense_claims(category);

CREATE TABLE IF NOT EXISTS claim_ledger (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  branch_id       uuid NOT NULL REFERENCES branches(id),
  month           integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            integer NOT NULL CHECK (year >= 2020),
  total_claimed   numeric(15,2) NOT NULL DEFAULT 0,
  total_paid      numeric(15,2) NOT NULL DEFAULT 0,
  remaining       numeric(15,2) NOT NULL DEFAULT 0,
  is_closed       boolean NOT NULL DEFAULT false,
  closed_at       timestamptz,
  closed_by       uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_claim_ledger_user ON claim_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_claim_ledger_branch ON claim_ledger(branch_id);

-- B7. CASH ADVANCES
DO $$ BEGIN
  CREATE TYPE cash_advance_status AS ENUM ('requested','approved','disbursed','settled','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cash_advances (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       uuid NOT NULL REFERENCES branches(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  status          cash_advance_status NOT NULL DEFAULT 'requested',
  amount          numeric(15,2) NOT NULL CHECK (amount > 0),
  purpose         text NOT NULL,
  approval_id     uuid REFERENCES approvals(id),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  disbursed_at    timestamptz,
  settled_at      timestamptz,
  settled_amount  numeric(15,2) DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_advances_user ON cash_advances(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_advances_status ON cash_advances(status);
CREATE INDEX IF NOT EXISTS idx_cash_advances_branch ON cash_advances(branch_id);

-- B8. FINANCIAL TRANSACTIONS
DO $$ BEGIN
  CREATE TYPE financial_transaction_type AS ENUM (
    'invoice_payment','supplier_payment','expense_claim_payment',
    'cash_advance_disbursement','cash_advance_settlement',
    'refund','adjustment','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE financial_direction AS ENUM ('inflow','outflow');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS financial_transactions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id           uuid NOT NULL REFERENCES branches(id),
  transaction_type    financial_transaction_type NOT NULL,
  direction           financial_direction NOT NULL,
  amount              numeric(15,2) NOT NULL CHECK (amount > 0),
  reference_id        uuid,
  reference_table     text,
  description         text NOT NULL,
  payment_method      text,
  payment_ref         text,
  recorded_by         uuid NOT NULL REFERENCES auth.users(id),
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_branch ON financial_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type ON financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_direction ON financial_transactions(direction);
CREATE INDEX IF NOT EXISTS idx_fin_tx_ref ON financial_transactions(reference_id, reference_table);
CREATE INDEX IF NOT EXISTS idx_fin_tx_created ON financial_transactions(created_at DESC);

-- B9. ADD branch_id TO MONTHLY_CLOSING
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_closing' AND column_name = 'branch_id') THEN
    ALTER TABLE monthly_closing ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

ALTER TABLE monthly_closing DROP CONSTRAINT IF EXISTS monthly_closing_month_year_key;
DO $$ BEGIN
  ALTER TABLE monthly_closing ADD CONSTRAINT monthly_closing_branch_month_year_key UNIQUE(branch_id, month, year);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- B10. TRIGGERS
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'product_branch_stock','stock_transfers',
      'branch_price_overrides','approvals',
      'suppliers','purchase_requests','purchase_orders',
      'expense_claims','claim_ledger','cash_advances',
      'financial_transactions'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I; '
      'CREATE TRIGGER trg_%s_updated_at '
      'BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;
