-- ============================================================================
-- 00014_faktur_role_system.sql
-- Description: Adds faktur_tasks table for Tukar Faktur / TTD Faktur visits
-- Created by: Antigravity
-- ============================================================================

-- 0. Add missing roles to user_role enum
COMMIT;
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'faktur';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'courier';
COMMIT;

-- 1. Create faktur_task_type and faktur_task_status enums
CREATE TYPE faktur_task_type AS ENUM ('ttd_faktur', 'tukar_faktur', 'others');
CREATE TYPE faktur_task_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled');

-- 2. Create faktur_tasks table
CREATE TABLE IF NOT EXISTS faktur_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    task_type faktur_task_type NOT NULL,
    status faktur_task_status NOT NULL DEFAULT 'pending',
    scheduled_date DATE,
    notes TEXT,
    completion_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE faktur_tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for faktur_tasks

-- Faktur staff can view all faktur tasks or just their own? Often they need to see the pool to claim them, or they are directly assigned.
CREATE POLICY "Faktur can view all tasks" 
ON faktur_tasks FOR SELECT 
USING (auth_user_role() = 'faktur');

-- Faktur staff can update tasks assigned to them, or claim unassigned ones
CREATE POLICY "Faktur can update assigned tasks" 
ON faktur_tasks FOR UPDATE 
USING (
  auth_user_role() = 'faktur' AND
  (assigned_to = auth.uid() OR assigned_to IS NULL)
);

-- Finance / Admin / Boss / Owner can full CRUD
CREATE POLICY "Staff can manage faktur tasks" 
ON faktur_tasks FOR ALL 
USING (auth_user_role() IN ('admin', 'owner', 'boss', 'finance', 'director'));

-- Clients can view tasks related to them
CREATE POLICY "Clients can view own faktur tasks" 
ON faktur_tasks FOR SELECT 
USING (auth_user_role() = 'client' AND client_id = auth.uid());

-- 5. Indexes for performance
CREATE INDEX idx_faktur_tasks_client ON faktur_tasks(client_id);
CREATE INDEX idx_faktur_tasks_assignee ON faktur_tasks(assigned_to);
CREATE INDEX idx_faktur_tasks_creator ON faktur_tasks(created_by);
CREATE INDEX idx_faktur_tasks_status ON faktur_tasks(status);
CREATE INDEX idx_faktur_tasks_date ON faktur_tasks(scheduled_date);
