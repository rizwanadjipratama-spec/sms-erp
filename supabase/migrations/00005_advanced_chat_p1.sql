-- ============================================================================
-- SUPER ADVANCED CHAT PANEL UPGRADE - PART 1
-- Run this script FIRST.
-- ============================================================================

-- 1. ADD 'TAX' TO CHAT CHANNELS ENUM
-- Note: Postgres requires new enum values to be committed before they can be used.
-- That's why this is in Part 1.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'chat_channel_type' AND e.enumlabel = 'tax') THEN
    ALTER TYPE chat_channel_type ADD VALUE 'tax';
  END IF;
END $$;
