-- ============================================================================
-- 00027_add_bio_to_profiles.sql
-- Adds `bio` field to the `profiles` table for internal staff to set
-- their personal background or short description in the My Profile page.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
