-- ============================================================================
-- AUTO APPROVE SETTINGS ON BRANCHES
-- ============================================================================

-- Add auto-approve configuration columns to branches
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS auto_approve_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approve_min_spend  numeric(15,2) NOT NULL DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS auto_approve_default_limit numeric(15,2) NOT NULL DEFAULT 500000;
