-- ============================================================================
-- Add hero_video_url to cms_settings
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_settings' AND column_name = 'hero_video_url'
  ) THEN
    ALTER TABLE cms_settings
      ADD COLUMN hero_video_url text;
  END IF;
END $$;
