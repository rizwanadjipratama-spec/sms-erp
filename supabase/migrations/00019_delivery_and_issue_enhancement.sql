-- ============================================================================
-- ORION ERP: Enhanced Delivery & Faktur + Multi-Technician Issue System
-- Migration: 00019_delivery_and_issue_enhancement.sql
-- Covers sms2.md Sections: 7, 8, 11 (Courier)
-- DEPENDS ON: 00018_orion_combined.sql (branches must exist)
-- ============================================================================

-- ============================================================================
-- SECTION 7: DELIVERY & FAKTUR TRACKING SYSTEM
-- ============================================================================

-- 1. Delivery status enum (full lifecycle)
DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'created','assigned','picking','picked','on_delivery',
    'delivered','confirmed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. DELIVERIES (main table — one per shipment)
CREATE TABLE IF NOT EXISTS deliveries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES invoices(id),
  branch_id       uuid NOT NULL REFERENCES branches(id),
  status          delivery_status NOT NULL DEFAULT 'created',
  notes           text,
  scheduled_date  date,
  delivered_at    timestamptz,
  confirmed_at    timestamptz,
  confirmed_by    uuid REFERENCES auth.users(id),
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_request ON deliveries(request_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch ON deliveries(branch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice ON deliveries(invoice_id) WHERE invoice_id IS NOT NULL;

-- 3. DELIVERY ITEMS (what's being delivered)
CREATE TABLE IF NOT EXISTS delivery_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id   uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id),
  quantity      integer NOT NULL CHECK (quantity > 0),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);

-- 4. DELIVERY TEAM (who is delivering — multiple people allowed)
DO $$ BEGIN
  CREATE TYPE delivery_team_role AS ENUM ('driver','courier','technician','marketing','finance','faktur','warehouse','purchasing','claim_officer','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS delivery_team (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id   uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  team_role     delivery_team_role NOT NULL DEFAULT 'courier',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_team_delivery ON delivery_team(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_team_user ON delivery_team(user_id);

-- 5. DELIVERY PROOFS (photo, signature, etc.)
DO $$ BEGIN
  CREATE TYPE delivery_proof_type AS ENUM ('photo','signature','document','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS delivery_proofs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id   uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  proof_type    delivery_proof_type NOT NULL DEFAULT 'photo',
  file_url      text NOT NULL,
  caption       text,
  uploaded_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_delivery ON delivery_proofs(delivery_id);

-- 6. DELIVERY STATUS LOGS (audit trail)
CREATE TABLE IF NOT EXISTS delivery_status_logs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id   uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  from_status   delivery_status,
  to_status     delivery_status NOT NULL,
  changed_by    uuid NOT NULL REFERENCES auth.users(id),
  note          text,
  latitude      double precision,
  longitude     double precision,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_logs_delivery ON delivery_status_logs(delivery_id);

-- ============================================================================
-- SECTION 8: ENHANCED ISSUE / TECHNICIAN SYSTEM
-- Extends existing service_issues from 00012 with multi-tech + expanded statuses
-- ============================================================================

-- 7. Expand service_issue_status with new values
ALTER TYPE service_issue_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE service_issue_status ADD VALUE IF NOT EXISTS 'waiting_parts';
ALTER TYPE service_issue_status ADD VALUE IF NOT EXISTS 'testing';
ALTER TYPE service_issue_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE service_issue_status ADD VALUE IF NOT EXISTS 'reported';

-- 8. ADD branch_id to service_issues
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_issues' AND column_name = 'branch_id') THEN
    ALTER TABLE service_issues ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
END $$;

-- 9. ADD priority to service_issues
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_issues' AND column_name = 'priority') THEN
    ALTER TABLE service_issues ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','critical'));
  END IF;
END $$;

-- 10. ISSUE TECHNICIANS (multi-tech support — primary + supporting)
DO $$ BEGIN
  CREATE TYPE issue_tech_role AS ENUM ('primary','supporting');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS issue_technicians (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id      uuid NOT NULL REFERENCES service_issues(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES auth.users(id),
  tech_role     issue_tech_role NOT NULL DEFAULT 'supporting',
  joined_at     timestamptz NOT NULL DEFAULT now(),
  notes         text,
  UNIQUE(issue_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_techs_issue ON issue_technicians(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_techs_tech ON issue_technicians(technician_id);

-- 11. ISSUE KNOWLEDGE BASE (completed issues become knowledge)
CREATE TABLE IF NOT EXISTS issue_knowledge_base (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id        uuid REFERENCES service_issues(id),
  title           text NOT NULL,
  device_name     text,
  problem         text NOT NULL,
  solution        text NOT NULL,
  tags            text[] DEFAULT '{}',
  is_published    boolean NOT NULL DEFAULT false,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON issue_knowledge_base USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_device ON issue_knowledge_base(device_name) WHERE device_name IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'deliveries','delivery_status_logs','issue_knowledge_base'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I; '
      'CREATE TRIGGER trg_%s_updated_at '
      'BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;
