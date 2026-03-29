-- ============================================================================
-- FIX: Grant table permissions to authenticated & anon roles
-- THIS IS THE MISSING PIECE — RLS policies only work if the role has 
-- table-level GRANT permissions first!
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. GRANT PERMISSIONS ON ALL TABLES TO authenticated ROLE
-- ============================================================================

-- Profiles: users need full CRUD on their own profile
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Products: everyone can read, staff can write
GRANT SELECT ON products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON products TO authenticated;

-- Price List: everyone can read, staff can write
GRANT SELECT ON price_list TO authenticated;
GRANT INSERT, UPDATE ON price_list TO authenticated;

-- Requests (Orders): users create & read, staff manages
GRANT SELECT, INSERT, UPDATE ON requests TO authenticated;

-- Request Items
GRANT SELECT, INSERT, UPDATE ON request_items TO authenticated;

-- Invoices
GRANT SELECT, INSERT, UPDATE ON invoices TO authenticated;

-- Payment Promises
GRANT SELECT, INSERT, UPDATE ON payment_promises TO authenticated;

-- Delivery Logs
GRANT SELECT, INSERT, UPDATE ON delivery_logs TO authenticated;

-- Inventory Logs
GRANT SELECT, INSERT ON inventory_logs TO authenticated;

-- Issues
GRANT SELECT, INSERT, UPDATE ON issues TO authenticated;

-- Monthly Closing
GRANT SELECT, INSERT, UPDATE ON monthly_closing TO authenticated;

-- Notifications
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;

-- Chat
GRANT SELECT, INSERT, UPDATE ON chat_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE ON chat_channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON chat_messages TO authenticated;

-- CMS (read for public, write for staff)
GRANT SELECT, INSERT, UPDATE ON cms_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cms_media TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cms_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cms_solutions TO authenticated;

-- Employee of Month
GRANT SELECT, INSERT ON employee_of_month TO authenticated;

-- Logs
GRANT SELECT, INSERT ON activity_logs TO authenticated;
GRANT SELECT, INSERT ON system_logs TO authenticated;
GRANT SELECT, INSERT ON backup_logs TO authenticated;

-- Automation
GRANT SELECT, INSERT, UPDATE ON automation_events TO authenticated;
GRANT SELECT, INSERT ON automation_webhooks TO authenticated;
GRANT SELECT, INSERT ON automation_logs TO authenticated;

-- Email Templates
GRANT SELECT ON email_templates TO authenticated;

-- ============================================================================
-- 2. GRANT READ PERMISSIONS TO anon ROLE (public pages)
-- ============================================================================

-- Public pages need to read products and CMS content
GRANT SELECT ON products TO anon;
GRANT SELECT ON price_list TO anon;
GRANT SELECT ON cms_sections TO anon;
GRANT SELECT ON cms_media TO anon;
GRANT SELECT ON cms_partners TO anon;
GRANT SELECT ON cms_solutions TO anon;

-- ============================================================================
-- 3. GRANT USAGE ON SEQUENCES (for auto-generated IDs)
-- ============================================================================
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================================================
-- 4. GRANT EXECUTE on RPC functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION has_any_role(user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION unread_notification_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unread_chat_count(uuid) TO authenticated;

-- ============================================================================
-- 5. VERIFY — check grants on profiles table
-- ============================================================================
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY grantee, privilege_type;
