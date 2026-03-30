-- Migration: Add last_active_at to profiles for active user tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_active_at timestamptz;
  END IF;
END $$;

-- Index for querying active users (active in last N minutes)
CREATE INDEX IF NOT EXISTS idx_profiles_last_active
  ON profiles(last_active_at DESC) WHERE last_active_at IS NOT NULL;

COMMENT ON COLUMN profiles.last_active_at IS 'Updated periodically by client heartbeat to track online status';
