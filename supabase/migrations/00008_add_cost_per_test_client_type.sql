-- ============================================================================
-- 00008: Add 'cost_per_test' to client_type enum
-- Required for the 3-tier pricing system (Regular / KSO / Cost Per Test)
-- ============================================================================

ALTER TYPE client_type ADD VALUE IF NOT EXISTS 'cost_per_test';
