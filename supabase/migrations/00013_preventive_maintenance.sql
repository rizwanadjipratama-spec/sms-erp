-- ============================================================================
-- 00013_preventive_maintenance.sql
-- Description: Adds equipment assets and preventive maintenance schedules
-- Created by: Antigravity
-- ============================================================================

-- 1. Create pm_status enum
CREATE TYPE pm_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'missed');

-- 2. Create equipment_assets table
CREATE TABLE IF NOT EXISTS equipment_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    area_id UUID REFERENCES technician_areas(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    installation_date DATE,
    pm_frequency_months INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, serial_number)
);

-- 3. Create pm_schedules table
CREATE TABLE IF NOT EXISTS pm_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
    technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    status pm_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_schedules ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for equipment_assets

-- Clients can view their own assets
CREATE POLICY "Clients can view own assets" 
ON equipment_assets FOR SELECT 
USING (auth_user_role() = 'client' AND client_id = auth.uid());

-- Technicians can view all assets
CREATE POLICY "Technicians can view all assets" 
ON equipment_assets FOR SELECT 
USING (auth_user_role() = 'technician');

-- Admins/Owners/Warehouse can full CRUD
CREATE POLICY "Staff can manage assets" 
ON equipment_assets FOR ALL 
USING (auth_user_role() IN ('admin', 'owner', 'warehouse', 'boss'));

-- 6. RLS Policies for pm_schedules

-- Clients can view their own PM schedules (via asset -> client_id)
CREATE POLICY "Clients can view own pm schedules" 
ON pm_schedules FOR SELECT 
USING (
  auth_user_role() = 'client' AND 
  EXISTS (
    SELECT 1 FROM equipment_assets e 
    WHERE e.id = pm_schedules.asset_id 
    AND e.client_id = auth.uid()
  )
);

-- Technicians can view all PM schedules
CREATE POLICY "Technicians can view all pm schedules" 
ON pm_schedules FOR SELECT 
USING (auth_user_role() = 'technician');

-- Technicians can update PM schedules assigned to them OR in their assigned area
CREATE POLICY "Technicians can update assigned pm schedules" 
ON pm_schedules FOR UPDATE 
USING (
  auth_user_role() = 'technician' AND
  (
    technician_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM equipment_assets e
      JOIN technician_areas a ON e.area_id = a.id
      WHERE e.id = pm_schedules.asset_id
      AND a.technician_id = auth.uid()
    ) OR
    technician_id IS NULL -- Can claim unassigned ones
  )
);

-- Admins/Owners can full CRUD
CREATE POLICY "Staff can manage pm schedules" 
ON pm_schedules FOR ALL 
USING (auth_user_role() IN ('admin', 'owner', 'boss'));

-- 7. Indexes for performance
CREATE INDEX idx_equipment_assets_client ON equipment_assets(client_id);
CREATE INDEX idx_equipment_assets_area ON equipment_assets(area_id);
CREATE INDEX idx_equipment_assets_product ON equipment_assets(product_id);
CREATE INDEX idx_equipment_assets_status ON equipment_assets(status);

CREATE INDEX idx_pm_schedules_asset ON pm_schedules(asset_id);
CREATE INDEX idx_pm_schedules_technician ON pm_schedules(technician_id);
CREATE INDEX idx_pm_schedules_due_date ON pm_schedules(due_date);
CREATE INDEX idx_pm_schedules_status ON pm_schedules(status);
