-- ============================================================================
-- 00025_attendance_system.sql
-- Adds geofencing to branches + creates attendance_records table
-- ============================================================================

-- 1. Add geofencing columns to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS geofence_radius INT NOT NULL DEFAULT 150;

-- 2. Seed Bogor branch coordinates (JL. BOULEVARD V1 No.32, Tanah Sareal)
-- Cirebon & Purwokerto: placeholders — update with real coordinates later
UPDATE branches SET latitude = -6.5615, longitude = 106.8106 WHERE LOWER(name) LIKE '%bogor%';
-- UPDATE branches SET latitude = -6.7320, longitude = 108.5523 WHERE LOWER(name) LIKE '%cirebon%';
-- UPDATE branches SET latitude = -7.4214, longitude = 109.2344 WHERE LOWER(name) LIKE '%purwokerto%';

-- 3. Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    clock_in        TIMESTAMPTZ,
    clock_out       TIMESTAMPTZ,
    clock_in_lat    DOUBLE PRECISION,
    clock_in_lng    DOUBLE PRECISION,
    clock_out_lat   DOUBLE PRECISION,
    clock_out_lng   DOUBLE PRECISION,
    is_late         BOOLEAN NOT NULL DEFAULT false,
    is_early_leave  BOOLEAN NOT NULL DEFAULT false,
    is_overtime     BOOLEAN NOT NULL DEFAULT false,
    early_leave_reason TEXT,
    overtime_reason TEXT,
    proof_url       TEXT,
    is_manual       BOOLEAN NOT NULL DEFAULT false,
    manual_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user   ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_late   ON attendance_records(is_late) WHERE is_late = true;

-- 4. Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Grant table-level access
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_records TO authenticated;
GRANT SELECT ON attendance_records TO anon;

-- Users can view their own records
CREATE POLICY "Users can view own attendance"
    ON attendance_records FOR SELECT
    USING (auth.uid() = user_id);

-- Supervisors can view all records
CREATE POLICY "Supervisors can view all attendance"
    ON attendance_records FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner','admin','director','manager')
        )
    );

-- All authenticated can see today's attendance (for dashboard)
CREATE POLICY "All can view today attendance"
    ON attendance_records FOR SELECT
    USING (date = CURRENT_DATE);

-- Users can insert their own records
CREATE POLICY "Users can clock in"
    ON attendance_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own records (clock-out)
CREATE POLICY "Users can clock out"
    ON attendance_records FOR UPDATE
    USING (auth.uid() = user_id);

-- Supervisors can insert/update any record (admin override)
CREATE POLICY "Supervisors can override attendance"
    ON attendance_records FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner','admin','director','manager')
        )
    );

CREATE POLICY "Supervisors can update attendance"
    ON attendance_records FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner','admin','director','manager')
        )
    );
