-- ============================================================================
-- SUPER ADVANCED CHAT PANEL UPGRADE (UNIFIED SCRIPT)
-- Fixes RLS, adds 'tax' channel, and creates advanced search RPCs
-- ============================================================================

-- ============================================================================
-- 1. FIX RLS AMBIGUITY ON CHAT CHANNELS
-- ============================================================================
-- The previous policy used 'm.channel_id = id' which postgres resolved as 
-- m.channel_id = m.id (ambiguous inside the subquery). 
-- This fixes the 'undefined' channels for non-admins.
DROP POLICY IF EXISTS chat_channels_select ON chat_channels;

CREATE POLICY chat_channels_select ON chat_channels FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_channel_members m 
    WHERE m.channel_id = chat_channels.id 
      AND m.user_id = auth.uid()
  )
  OR has_any_role(ARRAY['admin','owner']::user_role[])
);

-- ============================================================================
-- 2. ADD 'TAX' TO CHAT CHANNELS ENUM
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'chat_channel_type' AND e.enumlabel = 'tax') THEN
    ALTER TYPE chat_channel_type ADD VALUE 'tax';
  END IF;
END $$;

-- ============================================================================
-- 3. INSERT TAX CHANNEL & SYNC USERS (DYNAMIC EXECUTION)
-- ============================================================================
-- We use EXECUTE here to bypass the PostgreSQL parse-time enum check.
-- This allows the entire script to run in a single transaction without ERROR 55P04.
DO $$
BEGIN
  EXECUTE '
    INSERT INTO chat_channels (name, channel_type, description)
    SELECT ''Tax & Compliance'', ''tax'', ''Tax preparation, audits, and compliance discussions''
    WHERE NOT EXISTS (
      SELECT 1 FROM chat_channels WHERE channel_type::text = ''tax''
    );
  ';

  EXECUTE '
    INSERT INTO chat_channel_members (channel_id, user_id)
    SELECT c.id, p.id
    FROM profiles p
    CROSS JOIN chat_channels c
    WHERE p.role::text = ''tax'' 
      AND c.channel_type::text = ''tax''
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  ';
END $$;

-- ============================================================================
-- 4. ADVANCED SEARCH RPC FOR MESSAGES (High Performance)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_chat_messages(
  p_channel_id uuid,
  p_search_query text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  channel_id uuid,
  sender_id uuid,
  content text,
  file_url text,
  file_name text,
  file_type text,
  is_edited boolean,
  is_deleted boolean,
  reply_to uuid,
  created_at timestamptz,
  updated_at timestamptz,
  sender_name text,
  sender_email text,
  sender_avatar text,
  sender_role text
) AS $$
BEGIN
  -- Security check: ensure user has access to channel
  IF NOT EXISTS (
    SELECT 1 FROM chat_channel_members m 
    WHERE m.channel_id = p_channel_id 
      AND m.user_id = auth.uid()
  ) AND NOT has_any_role(ARRAY['admin','owner']::user_role[]) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    m.id, m.channel_id, m.sender_id, m.content, m.file_url, m.file_name, m.file_type, 
    m.is_edited, m.is_deleted, m.reply_to, m.created_at, m.updated_at,
    p.name AS sender_name, p.email AS sender_email, p.avatar_url AS sender_avatar, p.role::text AS sender_role
  FROM chat_messages m
  LEFT JOIN profiles p ON p.id = m.sender_id
  WHERE m.channel_id = p_channel_id
    AND m.is_deleted = false
    AND (p_search_query IS NULL OR p_search_query = '' OR m.content ILIKE '%' || p_search_query || '%')
    AND (p_start_date IS NULL OR m.created_at >= p_start_date)
    AND (p_end_date IS NULL OR m.created_at <= p_end_date)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_chat_messages(uuid, text, timestamptz, timestamptz, integer, integer) TO authenticated;
