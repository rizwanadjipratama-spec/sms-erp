-- ============================================================================
-- 00024_leave_management.sql
-- Description: Creates the `leave_requests` table, adds `leave_balance` to `profiles`, 
-- and configures the `leave-attachments` storage bucket.
-- ============================================================================

-- 1. Add leave_balance to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leave_balance INTEGER NOT NULL DEFAULT 12;

-- 2. Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('annual', 'sick', 'maternity', 'marriage', 'unpaid')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying active leaves efficiently
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status_dates ON leave_requests(status, start_date, end_date);

-- Activate RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Grant table-level access (required by Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON leave_requests TO authenticated;
GRANT SELECT ON leave_requests TO anon;

-- Select Policies
CREATE POLICY "Users can view own leaves" 
    ON leave_requests FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view all leaves" 
    ON leave_requests FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'admin', 'director', 'manager')
        )
    );

CREATE POLICY "Approved leaves are visible to all" 
    ON leave_requests FOR SELECT 
    USING (status = 'approved');

-- Insert Policies
CREATE POLICY "Users can insert own leaves" 
    ON leave_requests FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Update Policies
CREATE POLICY "Supervisors can update leaves" 
    ON leave_requests FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'admin', 'director', 'manager')
        )
    );

-- Delete Policies
CREATE POLICY "Users can delete their own pending leaves"
    ON leave_requests FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');


-- ==========================================
-- UPDATE PROFILES POLICY FOR SUPERVISORS
-- ==========================================
-- Allow Supervisors to update the leave_balance of other profiles.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Supervisors can update profiles'
    ) THEN
        CREATE POLICY "Supervisors can update profiles" ON profiles
            FOR UPDATE 
            USING (
                EXISTS (
                    SELECT 1 FROM profiles p 
                    WHERE p.id = auth.uid() 
                    AND p.role IN ('owner', 'admin', 'director', 'manager')
                )
            );
    END IF;
END $$;


-- ==========================================
-- STORAGE BUCKET: leave-attachments
-- ==========================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('leave-attachments', 'leave-attachments', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DO $$ 
BEGIN
    -- Select: Anyone can view attachments (or restrict to authenticated users)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can view leave attachments'
    ) THEN
        CREATE POLICY "Anyone can view leave attachments" ON storage.objects FOR SELECT USING (bucket_id = 'leave-attachments');
    END IF;

    -- Insert: Authenticated users can upload attachments
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload leave attachments'
    ) THEN
        CREATE POLICY "Authenticated users can upload leave attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'leave-attachments' AND auth.role() = 'authenticated');
    END IF;

    -- Update: Users can update their own uploads
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can update their own leave attachments'
    ) THEN
        CREATE POLICY "Users can update their own leave attachments" ON storage.objects FOR UPDATE USING (bucket_id = 'leave-attachments' AND auth.uid() = owner);
    END IF;
    
    -- Delete: Users can delete their own uploads
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own leave attachments'
    ) THEN
        CREATE POLICY "Users can delete their own leave attachments" ON storage.objects FOR DELETE USING (bucket_id = 'leave-attachments' AND auth.uid() = owner);
    END IF;
END $$;
