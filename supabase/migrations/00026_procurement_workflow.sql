-- ============================================================================
-- 00026_procurement_workflow.sql
-- Adds `rejection_reason` to `purchase_requests` table to support the new
-- Supervisor Approval mechanic (owner, admin, marketing, boss).
-- ============================================================================

ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
