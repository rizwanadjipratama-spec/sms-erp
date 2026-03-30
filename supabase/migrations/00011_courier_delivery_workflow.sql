-- Migration: Courier role + delivery sub-status tracking
-- Adds courier as a separate role with 4-stage delivery tracking

-- 1. Add 'courier' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'courier';

-- 2. Create delivery sub-status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_sub_status') THEN
    CREATE TYPE delivery_sub_status AS ENUM ('otw', 'arrived', 'delivering', 'completed');
  END IF;
END $$;

-- 3. Update delivery_logs table
DO $$
BEGIN
  -- Add courier_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_logs' AND column_name = 'courier_id'
  ) THEN
    ALTER TABLE delivery_logs
      ADD COLUMN courier_id uuid REFERENCES auth.users(id);
  END IF;

  -- Add accompanying_staff column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_logs' AND column_name = 'accompanying_staff'
  ) THEN
    ALTER TABLE delivery_logs
      ADD COLUMN accompanying_staff text;
  END IF;

  -- Make technician_id nullable (was NOT NULL)
  ALTER TABLE delivery_logs ALTER COLUMN technician_id DROP NOT NULL;

  -- Add CHECK: at least one of technician_id or courier_id must be set
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_delivery_actor'
  ) THEN
    ALTER TABLE delivery_logs
      ADD CONSTRAINT chk_delivery_actor
      CHECK (technician_id IS NOT NULL OR courier_id IS NOT NULL);
  END IF;
END $$;

-- 4. Add assigned_courier_id to requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'assigned_courier_id'
  ) THEN
    ALTER TABLE requests
      ADD COLUMN assigned_courier_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_logs_courier
  ON delivery_logs(courier_id) WHERE courier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_logs_status
  ON delivery_logs(status);

CREATE INDEX IF NOT EXISTS idx_requests_courier
  ON requests(assigned_courier_id) WHERE assigned_courier_id IS NOT NULL;

-- 6. RLS policies for courier on delivery_logs
DO $$
BEGIN
  -- Drop existing restrictive policies and recreate with courier support
  DROP POLICY IF EXISTS "delivery_logs_select" ON delivery_logs;
  DROP POLICY IF EXISTS "delivery_logs_insert" ON delivery_logs;
  DROP POLICY IF EXISTS "delivery_logs_update" ON delivery_logs;

  -- SELECT: technician sees own, courier sees own, admin/owner see all
  CREATE POLICY "delivery_logs_select" ON delivery_logs FOR SELECT USING (
    technician_id = auth.uid()
    OR courier_id = auth.uid()
    OR auth_user_role() IN ('admin', 'owner')
  );

  -- INSERT: technician or courier can insert own logs
  CREATE POLICY "delivery_logs_insert" ON delivery_logs FOR INSERT WITH CHECK (
    (auth_user_role() = 'technician' AND technician_id = auth.uid())
    OR (auth_user_role() = 'courier' AND courier_id = auth.uid())
  );

  -- UPDATE: technician or courier can update own logs
  CREATE POLICY "delivery_logs_update" ON delivery_logs FOR UPDATE USING (
    technician_id = auth.uid() OR courier_id = auth.uid()
  );
END $$;

-- 7. RLS policy for courier on requests (can see ready/on_delivery/delivered)
DO $$
BEGIN
  -- Check if courier-specific policy exists, if not create it
  DROP POLICY IF EXISTS "requests_courier_select" ON requests;
  CREATE POLICY "requests_courier_select" ON requests FOR SELECT USING (
    auth_user_role() = 'courier'
    AND status IN ('ready', 'on_delivery', 'delivered')
  );

  -- Courier can update requests (for claiming and completing delivery)
  DROP POLICY IF EXISTS "requests_courier_update" ON requests;
  CREATE POLICY "requests_courier_update" ON requests FOR UPDATE USING (
    auth_user_role() = 'courier'
    AND (
      status = 'ready'
      OR (status IN ('on_delivery', 'delivered') AND assigned_courier_id = auth.uid())
    )
  );
END $$;

COMMENT ON COLUMN delivery_logs.courier_id IS 'Courier who performed the delivery';
COMMENT ON COLUMN delivery_logs.accompanying_staff IS 'Names of staff accompanying the courier';
COMMENT ON COLUMN requests.assigned_courier_id IS 'Courier assigned to deliver this order';
