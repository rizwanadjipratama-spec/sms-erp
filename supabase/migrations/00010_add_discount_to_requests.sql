-- Migration: Add discount fields to requests table
-- Allows Marketing/Boss to apply per-order discounts

DO $$
BEGIN
  -- Create discount_type enum if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
    CREATE TYPE discount_type AS ENUM ('percent', 'fixed');
  END IF;

  -- Add discount columns to requests
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE requests
      ADD COLUMN discount_type discount_type,
      ADD COLUMN discount_value numeric(15,2) DEFAULT 0,
      ADD COLUMN discount_amount numeric(15,2) DEFAULT 0,
      ADD COLUMN discount_reason text,
      ADD COLUMN discounted_by uuid REFERENCES auth.users(id);
  END IF;

  -- Add discount_amount to invoices for proper tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN discount_amount numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Index for discount queries
CREATE INDEX IF NOT EXISTS idx_requests_discounted
  ON requests(discounted_by) WHERE discount_type IS NOT NULL;

COMMENT ON COLUMN requests.discount_type IS 'Type of discount: percent or fixed amount';
COMMENT ON COLUMN requests.discount_value IS 'Discount value: percentage (0-100) or fixed amount';
COMMENT ON COLUMN requests.discount_amount IS 'Calculated discount amount in currency';
COMMENT ON COLUMN requests.discount_reason IS 'Reason for discount (audit trail)';
COMMENT ON COLUMN requests.discounted_by IS 'User who applied the discount';
COMMENT ON COLUMN invoices.discount_amount IS 'Discount amount carried from request';
