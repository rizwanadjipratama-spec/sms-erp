-- Migration: Technician Area & Issue System
-- Created by: Antigravity (2026-03-30)
-- Tables: technician_areas, area_transfer_requests, service_issues, service_issue_logs

-- 1. Create service_issue_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_issue_status') THEN
    CREATE TYPE service_issue_status AS ENUM ('open', 'otw', 'arrived', 'working', 'completed');
  END IF;
END $$;

-- 2. Create technician_areas table
CREATE TABLE IF NOT EXISTS technician_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_name text NOT NULL,
  hospital_name text NOT NULL,
  address text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create area_transfer_requests table
CREATE TABLE IF NOT EXISTS area_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES technician_areas(id) ON DELETE CASCADE,
  from_technician_id uuid NOT NULL REFERENCES auth.users(id),
  to_technician_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  note text,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create service_issues table
CREATE TABLE IF NOT EXISTS service_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid NOT NULL REFERENCES auth.users(id),
  area_id uuid REFERENCES technician_areas(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location text NOT NULL,
  device_name text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  notes text,
  photo_urls text[] DEFAULT '{}',
  status service_issue_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_at timestamptz,
  taken_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create service_issue_logs table
CREATE TABLE IF NOT EXISTS service_issue_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES service_issues(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_technician_areas_technician ON technician_areas(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_areas_active ON technician_areas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_issues_status ON service_issues(status);
CREATE INDEX IF NOT EXISTS idx_service_issues_assigned ON service_issues(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_issues_reported ON service_issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_service_issues_area ON service_issues(area_id) WHERE area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_issue_logs_issue ON service_issue_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_area_transfers_status ON area_transfer_requests(status) WHERE status = 'pending';

-- 7. RLS Policies

-- technician_areas
ALTER TABLE technician_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_areas_select" ON technician_areas FOR SELECT USING (
  auth_user_role() IN ('technician', 'admin', 'owner')
  OR technician_id = auth.uid()
);

CREATE POLICY "tech_areas_insert" ON technician_areas FOR INSERT WITH CHECK (
  auth_user_role() IN ('admin', 'owner')
);

CREATE POLICY "tech_areas_update" ON technician_areas FOR UPDATE USING (
  auth_user_role() IN ('admin', 'owner')
);

CREATE POLICY "tech_areas_delete" ON technician_areas FOR DELETE USING (
  auth_user_role() IN ('admin', 'owner')
);

-- area_transfer_requests
ALTER TABLE area_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "area_transfers_select" ON area_transfer_requests FOR SELECT USING (
  from_technician_id = auth.uid()
  OR to_technician_id = auth.uid()
  OR auth_user_role() IN ('admin', 'owner')
);

CREATE POLICY "area_transfers_insert" ON area_transfer_requests FOR INSERT WITH CHECK (
  auth_user_role() = 'technician' AND from_technician_id = auth.uid()
);

CREATE POLICY "area_transfers_update" ON area_transfer_requests FOR UPDATE USING (
  to_technician_id = auth.uid()
  OR auth_user_role() IN ('admin', 'owner')
);

-- service_issues
ALTER TABLE service_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_issues_select" ON service_issues FOR SELECT USING (
  reported_by = auth.uid()
  OR assigned_to = auth.uid()
  OR auth_user_role() IN ('technician', 'admin', 'owner')
);

CREATE POLICY "service_issues_insert" ON service_issues FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "service_issues_update" ON service_issues FOR UPDATE USING (
  assigned_to = auth.uid()
  OR auth_user_role() IN ('admin', 'owner')
);

-- service_issue_logs
ALTER TABLE service_issue_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issue_logs_select" ON service_issue_logs FOR SELECT USING (
  auth_user_role() IN ('technician', 'admin', 'owner')
  OR EXISTS (SELECT 1 FROM service_issues WHERE id = issue_id AND reported_by = auth.uid())
);

CREATE POLICY "issue_logs_insert" ON service_issue_logs FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
