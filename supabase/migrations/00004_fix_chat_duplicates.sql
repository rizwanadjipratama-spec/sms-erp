-- ============================================================================
-- FIX: Remove duplicate chat_channel_members and enforce UNIQUE constraint
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Deduplicate chat_channel_members (keep the oldest entry for each channel/user combo)
DELETE FROM chat_channel_members
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, row_number() OVER (
      PARTITION BY channel_id, user_id
      ORDER BY joined_at ASC
    ) as rnum
    FROM chat_channel_members
  ) t
  WHERE t.rnum > 1
);

-- 2. Drop the constraint if it exists, to recreate it cleanly
ALTER TABLE chat_channel_members
DROP CONSTRAINT IF EXISTS chat_channel_members_channel_id_user_id_key;

-- 3. Add the unique constraint EXPLICITLY
ALTER TABLE chat_channel_members
ADD CONSTRAINT chat_channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id);

-- 4. Also fix the trigger to explicitly target the conflict columns
CREATE OR REPLACE FUNCTION auto_join_chat_channels()
RETURNS trigger AS $$
DECLARE
  role_text text;
BEGIN
  -- Everyone joins general
  INSERT INTO chat_channel_members (channel_id, user_id)
  SELECT id, NEW.id FROM chat_channels WHERE channel_type = 'general'
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  -- Join role-specific channel (cast through text to avoid enum mismatch)
  role_text := NEW.role::text;
  IF role_text IN ('marketing','finance','warehouse','technician','admin','owner') THEN
    INSERT INTO chat_channel_members (channel_id, user_id)
    SELECT id, NEW.id FROM chat_channels WHERE channel_type = role_text::chat_channel_type
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  -- Owner and admin see all channels
  IF role_text IN ('owner','admin') THEN
    INSERT INTO chat_channel_members (channel_id, user_id)
    SELECT id, NEW.id FROM chat_channels WHERE is_active = true
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
