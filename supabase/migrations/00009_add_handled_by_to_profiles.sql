-- ============================================================================
-- 00009: Add handled_by to profiles for marketing client assignment
-- Each client can be assigned to a specific marketing person
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'handled_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN handled_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_handled_by ON profiles(handled_by) WHERE handled_by IS NOT NULL;
