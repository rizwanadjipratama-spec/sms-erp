-- ============================================================================
-- WEBSMS ERP SYSTEM — COMPLETE DATABASE SCHEMA
-- Migration: 00001_initial_schema.sql
-- Matches: src/types/types.ts exactly
-- Production-grade enterprise schema
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- trigram search for fast LIKE queries

-- ============================================================================
-- 2. CUSTOM ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'client','marketing','boss','finance','warehouse','technician','admin','owner','tax'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE client_type AS ENUM ('regular','kso');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'submitted','priced','approved','invoice_ready','preparing','ready',
    'on_delivery','delivered','completed','issue','resolved','cancelled','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_priority AS ENUM ('normal','cito');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft','issued','paid','overdue','cancelled','credited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info','success','warning','error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('open','in_progress','resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE log_level AS ENUM ('info','warning','error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_channel_type AS ENUM (
    'general','marketing','finance','warehouse','technician','admin','owner'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM (
    'Equipment','Consumables','Service & Support','Reagents','Service'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE backup_type AS ENUM ('database','storage','full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE backup_status AS ENUM ('pending','completed','failed','verified','restored','partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE automation_status AS ENUM ('pending','processed','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update updated_at on every row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: get the current user's role from profiles
-- Uses plpgsql so table reference is validated at execution time, not creation time
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role::user_role FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if user has a specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role::user_role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if user has any of the given roles
CREATE OR REPLACE FUNCTION has_any_role(required_roles user_role[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role::user_role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 4. TABLES
-- ============================================================================

-- 4.1 PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          user_role NOT NULL DEFAULT 'client',
  name          text,
  phone         text,
  address       text,
  client_type   client_type DEFAULT 'regular',
  pic_name      text,
  company       text,
  avatar_url    text,
  debt_amount   numeric(15,2) NOT NULL DEFAULT 0,
  debt_limit    numeric(15,2) NOT NULL DEFAULT 500000,
  two_factor_secret text,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  last_login    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  updated_by    uuid REFERENCES auth.users(id)
);

-- If profiles table already existed, add missing columns
-- NOTE: We do NOT alter column types (text -> enum) because existing RLS policies
-- depend on the column. The helper functions (has_role, has_any_role) use ::user_role
-- casts which handle text columns at runtime.
DO $$
BEGIN
  -- Add missing columns if the table existed before this migration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'pic_name') THEN
    ALTER TABLE profiles ADD COLUMN pic_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'company') THEN
    ALTER TABLE profiles ADD COLUMN company text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'debt_amount') THEN
    ALTER TABLE profiles ADD COLUMN debt_amount numeric(15,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'debt_limit') THEN
    ALTER TABLE profiles ADD COLUMN debt_limit numeric(15,2) NOT NULL DEFAULT 500000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_secret') THEN
    ALTER TABLE profiles ADD COLUMN two_factor_secret text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_enabled') THEN
    ALTER TABLE profiles ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login') THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_by') THEN
    ALTER TABLE profiles ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_by') THEN
    ALTER TABLE profiles ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_client_type ON profiles(client_type) WHERE client_type IS NOT NULL;

-- 4.2 PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  description   text,
  sku           text,
  category      product_category,
  image_url     text,
  stock         integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock     integer NOT NULL DEFAULT 5,
  unit          text NOT NULL DEFAULT 'pcs',
  is_active     boolean NOT NULL DEFAULT true,
  is_priced     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  updated_by    uuid REFERENCES auth.users(id)
);

-- Add missing columns if products table already existed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'description') THEN
    ALTER TABLE products ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku') THEN
    ALTER TABLE products ADD COLUMN sku text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url') THEN
    ALTER TABLE products ADD COLUMN image_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'min_stock') THEN
    ALTER TABLE products ADD COLUMN min_stock integer NOT NULL DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'unit') THEN
    ALTER TABLE products ADD COLUMN unit text NOT NULL DEFAULT 'pcs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_active') THEN
    ALTER TABLE products ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_priced') THEN
    ALTER TABLE products ADD COLUMN is_priced boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'created_by') THEN
    ALTER TABLE products ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'updated_by') THEN
    ALTER TABLE products ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_priced ON products(is_priced);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- 4.3 PRICE LIST
CREATE TABLE IF NOT EXISTS price_list (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_regular  numeric(15,2) NOT NULL DEFAULT 0 CHECK (price_regular >= 0),
  price_kso      numeric(15,2) NOT NULL DEFAULT 0 CHECK (price_kso >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id),
  updated_by     uuid REFERENCES auth.users(id),
  UNIQUE(product_id)
);

-- Add missing columns if price_list table already existed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'price_kso') THEN
    ALTER TABLE price_list ADD COLUMN price_kso numeric(15,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'effective_from') THEN
    ALTER TABLE price_list ADD COLUMN effective_from timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'effective_to') THEN
    ALTER TABLE price_list ADD COLUMN effective_to timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'is_active') THEN
    ALTER TABLE price_list ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'created_by') THEN
    ALTER TABLE price_list ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_list' AND column_name = 'updated_by') THEN
    ALTER TABLE price_list ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_price_list_product ON price_list(product_id);
CREATE INDEX IF NOT EXISTS idx_price_list_active ON price_list(is_active, effective_from);

-- 4.4 REQUESTS (Orders)
CREATE TABLE IF NOT EXISTS requests (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id),
  user_email              text,
  status                  request_status NOT NULL DEFAULT 'submitted',
  priority                request_priority NOT NULL DEFAULT 'normal',
  total_price             numeric(15,2) NOT NULL DEFAULT 0,
  note                    text,
  invoice_id              uuid,
  assigned_technician_id  uuid REFERENCES auth.users(id),
  rejection_reason        text,
  priced_at               timestamptz,
  approved_at             timestamptz,
  rejected_at             timestamptz,
  invoice_ready_at        timestamptz,
  preparing_at            timestamptz,
  ready_at                timestamptz,
  on_delivery_at          timestamptz,
  delivered_at            timestamptz,
  completed_at            timestamptz,
  cancelled_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES auth.users(id),
  updated_by              uuid REFERENCES auth.users(id)
);

-- Add missing columns if requests table already existed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'user_email') THEN
    ALTER TABLE requests ADD COLUMN user_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'invoice_id') THEN
    ALTER TABLE requests ADD COLUMN invoice_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'assigned_technician_id') THEN
    ALTER TABLE requests ADD COLUMN assigned_technician_id uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'rejection_reason') THEN
    ALTER TABLE requests ADD COLUMN rejection_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'priced_at') THEN
    ALTER TABLE requests ADD COLUMN priced_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'approved_at') THEN
    ALTER TABLE requests ADD COLUMN approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'rejected_at') THEN
    ALTER TABLE requests ADD COLUMN rejected_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'invoice_ready_at') THEN
    ALTER TABLE requests ADD COLUMN invoice_ready_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'preparing_at') THEN
    ALTER TABLE requests ADD COLUMN preparing_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'ready_at') THEN
    ALTER TABLE requests ADD COLUMN ready_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'on_delivery_at') THEN
    ALTER TABLE requests ADD COLUMN on_delivery_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'delivered_at') THEN
    ALTER TABLE requests ADD COLUMN delivered_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'completed_at') THEN
    ALTER TABLE requests ADD COLUMN completed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'cancelled_at') THEN
    ALTER TABLE requests ADD COLUMN cancelled_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'created_by') THEN
    ALTER TABLE requests ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'updated_by') THEN
    ALTER TABLE requests ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_technician ON requests(assigned_technician_id) WHERE assigned_technician_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_invoice_id ON requests(invoice_id);

-- 4.5 REQUEST ITEMS
CREATE TABLE IF NOT EXISTS request_items (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id     uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id),
  quantity       integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_order numeric(15,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_items_request ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_product ON request_items(product_id);

-- 4.6 INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  invoice_number  text NOT NULL UNIQUE,
  subtotal        numeric(15,2) NOT NULL DEFAULT 0,
  tax_rate        numeric(5,4) NOT NULL DEFAULT 0.11,
  tax_amount      numeric(15,2) NOT NULL DEFAULT 0,
  total           numeric(15,2) NOT NULL DEFAULT 0,
  status          invoice_status NOT NULL DEFAULT 'draft',
  issued_at       timestamptz,
  due_date        timestamptz,
  paid_at         timestamptz,
  payment_method  text,
  payment_ref     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE status IN ('issued','overdue');

-- Link requests.invoice_id -> invoices
ALTER TABLE requests DROP CONSTRAINT IF EXISTS fk_requests_invoice;
ALTER TABLE requests ADD CONSTRAINT fk_requests_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices(id);

-- 4.7 PAYMENT PROMISES
CREATE TABLE IF NOT EXISTS payment_promises (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  user_email    text,
  request_id    uuid REFERENCES requests(id),
  promise_date  timestamptz NOT NULL,
  note          text,
  fulfilled     boolean NOT NULL DEFAULT false,
  fulfilled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_promises_user ON payment_promises(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_promises_request ON payment_promises(request_id) WHERE request_id IS NOT NULL;

-- 4.8 DELIVERY LOGS
CREATE TABLE IF NOT EXISTS delivery_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'pending',
  note            text,
  proof_url       text,
  signature_url   text,
  delivered_at    timestamptz,
  latitude        double precision,
  longitude       double precision,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_order ON delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_technician ON delivery_logs(technician_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_delivered ON delivery_logs(delivered_at DESC);

-- 4.9 INVENTORY LOGS
CREATE TABLE IF NOT EXISTS inventory_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id    uuid REFERENCES requests(id),
  change      integer NOT NULL,
  balance     integer NOT NULL DEFAULT 0,
  reason      text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_order ON inventory_logs(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON inventory_logs(created_at DESC);

-- 4.10 ISSUES
CREATE TABLE IF NOT EXISTS issues (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  reported_by   uuid NOT NULL REFERENCES auth.users(id),
  assigned_to   uuid REFERENCES auth.users(id),
  description   text NOT NULL,
  status        issue_status NOT NULL DEFAULT 'open',
  resolution    text,
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_order ON issues(order_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);

-- 4.11 MONTHLY CLOSING
CREATE TABLE IF NOT EXISTS monthly_closing (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  month           integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            integer NOT NULL CHECK (year >= 2020),
  total_revenue   numeric(15,2) NOT NULL DEFAULT 0,
  total_tax       numeric(15,2) NOT NULL DEFAULT 0,
  orders_count    integer NOT NULL DEFAULT 0,
  paid_invoices   integer NOT NULL DEFAULT 0,
  unpaid_invoices integer NOT NULL DEFAULT 0,
  closed_by       uuid REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- 4.12 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text,
  message     text NOT NULL,
  type        notification_type NOT NULL DEFAULT 'info',
  read        boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  order_id    uuid REFERENCES requests(id),
  action_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id);

-- 4.13 CHAT CHANNELS
CREATE TABLE IF NOT EXISTS chat_channels (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  channel_type  chat_channel_type NOT NULL DEFAULT 'general',
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_type ON chat_channels(channel_type);

-- 4.14 CHAT CHANNEL MEMBERS
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id   uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON chat_channel_members(user_id);

-- 4.15 CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id  uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES auth.users(id),
  content     text NOT NULL,
  file_url    text,
  file_name   text,
  file_type   text,
  is_edited   boolean NOT NULL DEFAULT false,
  is_deleted  boolean NOT NULL DEFAULT false,
  reply_to    uuid REFERENCES chat_messages(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);

-- 4.16 CMS SECTIONS
CREATE TABLE IF NOT EXISTS cms_sections (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_key  text NOT NULL UNIQUE,
  title        text,
  subtitle     text,
  body         text,
  image_url    text,
  video_url    text,
  cta_text     text,
  cta_link     text,
  sort_order   integer NOT NULL DEFAULT 0,
  is_visible   boolean NOT NULL DEFAULT true,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id)
);

-- 4.17 CMS MEDIA
CREATE TABLE IF NOT EXISTS cms_media (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id  uuid REFERENCES cms_sections(id) ON DELETE SET NULL,
  title       text,
  alt_text    text,
  file_url    text NOT NULL,
  file_type   text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_cms_media_section ON cms_media(section_id);

-- 4.18 CMS PARTNERS
CREATE TABLE IF NOT EXISTS cms_partners (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  logo_url    text NOT NULL,
  website_url text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4.19 CMS SOLUTIONS
CREATE TABLE IF NOT EXISTS cms_solutions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        text NOT NULL UNIQUE,
  title       text NOT NULL,
  description text,
  category    product_category,
  image_url   text,
  specs       text[] NOT NULL DEFAULT '{}',
  use_case    text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4.20 EMPLOYEE OF MONTH
CREATE TABLE IF NOT EXISTS employee_of_month (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  month       integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        integer NOT NULL CHECK (year >= 2020),
  reason      text,
  photo_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  UNIQUE(month, year)
);

-- 4.21 ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id),
  user_email  text,
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  metadata    jsonb DEFAULT '{}',
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- 4.22 SYSTEM LOGS
CREATE TABLE IF NOT EXISTS system_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  level       log_level NOT NULL DEFAULT 'info',
  service     text NOT NULL,
  action      text NOT NULL,
  message     text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

-- 4.23 BACKUP LOGS
CREATE TABLE IF NOT EXISTS backup_logs (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_type  backup_type NOT NULL,
  file_url     text,
  status       backup_status NOT NULL DEFAULT 'pending',
  size         bigint,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

-- 4.24 AUTOMATION EVENTS
CREATE TABLE IF NOT EXISTS automation_events (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type   text NOT NULL,
  payload      jsonb DEFAULT '{}',
  status       automation_status NOT NULL DEFAULT 'pending',
  retry_count  integer NOT NULL DEFAULT 0,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_automation_events_status ON automation_events(status);
CREATE INDEX IF NOT EXISTS idx_automation_events_type ON automation_events(event_type);

-- 4.25 AUTOMATION WEBHOOKS
CREATE TABLE IF NOT EXISTS automation_webhooks (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type  text NOT NULL,
  webhook_url text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4.26 AUTOMATION LOGS
CREATE TABLE IF NOT EXISTS automation_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid REFERENCES automation_events(id),
  webhook_url text,
  status      text NOT NULL,
  response    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4.27 EMAIL TEMPLATES
CREATE TABLE IF NOT EXISTS email_templates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL UNIQUE,
  subject     text NOT NULL,
  body_html   text NOT NULL,
  variables   text[] DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. UPDATED_AT TRIGGERS (auto-set on all tables with updated_at)
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'profiles','products','price_list','requests','request_items',
      'invoices','payment_promises','delivery_logs','issues',
      'monthly_closing','chat_channels','chat_messages',
      'cms_sections','cms_media','cms_partners','cms_solutions',
      'email_templates'
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

-- ============================================================================
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, role, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'client',
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 7. BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- 7.1 Atomic stock decrement — prevents overselling
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty integer)
RETURNS integer AS $$
DECLARE
  new_stock integer;
BEGIN
  UPDATE products
    SET stock = stock - p_qty,
        updated_at = now()
  WHERE id = p_product_id
    AND stock >= p_qty
  RETURNING stock INTO new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  RETURN new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Atomic stock increment
CREATE OR REPLACE FUNCTION increment_stock(p_product_id uuid, p_qty integer)
RETURNS integer AS $$
DECLARE
  new_stock integer;
BEGIN
  UPDATE products
    SET stock = stock + p_qty,
        updated_at = now()
  WHERE id = p_product_id
  RETURNING stock INTO new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  RETURN new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 Generate invoice number (sequence-based, no race conditions)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  seq_val integer;
  yr text;
  mn text;
BEGIN
  seq_val := nextval('invoice_number_seq');
  yr := to_char(now(), 'YYYY');
  mn := to_char(now(), 'MM');
  RETURN format('INV/%s/%s/%s', yr, mn, lpad(seq_val::text, 5, '0'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.4 Unread notification count
CREATE OR REPLACE FUNCTION unread_notification_count(p_user_id uuid)
RETURNS bigint AS $$
  SELECT count(*) FROM notifications
  WHERE user_id = p_user_id AND read = false;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7.5 Unread chat message count
CREATE OR REPLACE FUNCTION unread_chat_count(p_user_id uuid)
RETURNS bigint AS $$
  SELECT count(*) FROM chat_messages m
  INNER JOIN chat_channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = p_user_id
  WHERE m.created_at > cm.last_read_at
    AND m.sender_id != p_user_id
    AND m.is_deleted = false;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7.6 Auto-join chat channels based on role
CREATE OR REPLACE FUNCTION auto_join_chat_channels()
RETURNS trigger AS $$
DECLARE
  role_channel chat_channel_type;
BEGIN
  -- Everyone joins general
  INSERT INTO chat_channel_members (channel_id, user_id)
  SELECT id, NEW.id FROM chat_channels WHERE channel_type = 'general'
  ON CONFLICT DO NOTHING;

  -- Join role-specific channel
  IF NEW.role IN ('marketing','finance','warehouse','technician','admin','owner') THEN
    role_channel := NEW.role::chat_channel_type;
    INSERT INTO chat_channel_members (channel_id, user_id)
    SELECT id, NEW.id FROM chat_channels WHERE channel_type = role_channel
    ON CONFLICT DO NOTHING;
  END IF;

  -- Owner and admin see all channels
  IF NEW.role IN ('owner','admin') THEN
    INSERT INTO chat_channel_members (channel_id, user_id)
    SELECT id, NEW.id FROM chat_channels WHERE is_active = true
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_join_chat ON profiles;
CREATE TRIGGER trg_auto_join_chat
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_join_chat_channels();

-- 7.7 Auto-sync product is_priced when price is set
CREATE OR REPLACE FUNCTION sync_product_is_priced()
RETURNS trigger AS $$
BEGIN
  UPDATE products SET is_priced = true, updated_at = now()
  WHERE id = NEW.product_id
    AND NOT is_priced
    AND NEW.is_active = true
    AND (NEW.price_regular > 0 OR NEW.price_kso > 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_priced ON price_list;
CREATE TRIGGER trg_sync_priced
  AFTER INSERT OR UPDATE ON price_list
  FOR EACH ROW EXECUTE FUNCTION sync_product_is_priced();

-- 7.8 Auto-notify on request status change
CREATE OR REPLACE FUNCTION notify_on_request_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, title, message, type, order_id)
    VALUES (
      NEW.user_id,
      'Order Status Updated',
      format('Your order has been updated to: %s', NEW.status::text),
      'info',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_request_change ON requests;
CREATE TRIGGER trg_notify_request_change
  AFTER UPDATE OF status ON requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_request_change();

-- 7.9 Auto-log activity on request status change
CREATE OR REPLACE FUNCTION log_request_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      COALESCE(NEW.updated_by, auth.uid()),
      'status_change',
      'request',
      NEW.id::text,
      jsonb_build_object(
        'previous_status', OLD.status::text,
        'new_status', NEW.status::text,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_request_status ON requests;
CREATE TRIGGER trg_log_request_status
  AFTER UPDATE OF status ON requests
  FOR EACH ROW EXECUTE FUNCTION log_request_status_change();

-- 7.10 Low stock alert
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.stock <= NEW.min_stock AND (OLD.stock IS NULL OR OLD.stock > OLD.min_stock) THEN
    INSERT INTO notifications (user_id, title, message, type)
    SELECT p.id, 'Low Stock Alert',
      format('Product "%s" is low on stock (%s remaining)', NEW.name, NEW.stock),
      'warning'
    FROM profiles p
    WHERE p.role IN ('warehouse','admin','owner') AND p.is_active = true;

    INSERT INTO automation_events (event_type, payload)
    VALUES ('low_stock', jsonb_build_object(
      'product_id', NEW.id,
      'product_name', NEW.name,
      'current_stock', NEW.stock,
      'min_stock', NEW.min_stock
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_low_stock ON products;
CREATE TRIGGER trg_low_stock
  AFTER UPDATE OF stock ON products
  FOR EACH ROW EXECUTE FUNCTION check_low_stock();

-- 7.11 Overdue invoice checker (call periodically via cron/edge function)
CREATE OR REPLACE FUNCTION check_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
    SET status = 'overdue', updated_at = now()
  WHERE status = 'issued'
    AND due_date < now();

  INSERT INTO notifications (user_id, title, message, type, order_id)
  SELECT p.id, 'Overdue Invoice',
    format('Invoice %s is overdue', i.invoice_number),
    'warning', i.order_id
  FROM invoices i
  CROSS JOIN profiles p
  WHERE i.status = 'overdue'
    AND p.role IN ('finance','owner')
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.order_id = i.order_id
        AND n.title = 'Overdue Invoice'
        AND n.created_at > now() - interval '1 day'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables and drop ALL existing policies first (idempotent)
DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'profiles','products','price_list','requests','request_items',
      'invoices','payment_promises','delivery_logs','inventory_logs',
      'issues','monthly_closing','notifications','chat_channels',
      'chat_channel_members','chat_messages','cms_sections','cms_media',
      'cms_partners','cms_solutions','employee_of_month','activity_logs',
      'system_logs','backup_logs','automation_events','automation_webhooks',
      'automation_logs','email_templates'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    -- Drop all existing policies on this table so we can recreate cleanly
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- -------------------------------------------------------
-- 8.1 PROFILES
-- -------------------------------------------------------
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
  OR (has_role('marketing') AND role = 'client')
);

CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- -------------------------------------------------------
-- 8.2 PRODUCTS (public read, staff manages)
-- -------------------------------------------------------
CREATE POLICY products_select ON products FOR SELECT USING (true);

CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (has_any_role(ARRAY['warehouse','marketing','admin','owner']::user_role[]));

CREATE POLICY products_update ON products FOR UPDATE
  USING (has_any_role(ARRAY['warehouse','marketing','admin','owner']::user_role[]));

CREATE POLICY products_delete ON products FOR DELETE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.3 PRICE LIST
-- -------------------------------------------------------
CREATE POLICY price_list_select ON price_list FOR SELECT USING (
  has_any_role(ARRAY['marketing','finance','boss','admin','owner','tax']::user_role[])
  OR (has_role('client') AND is_active = true)
);

CREATE POLICY price_list_manage ON price_list FOR ALL
  USING (has_any_role(ARRAY['marketing','admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.4 REQUESTS (role-based visibility)
-- -------------------------------------------------------
CREATE POLICY requests_select ON requests FOR SELECT USING (
  user_id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
  OR (has_role('marketing') AND status = 'submitted')
  OR (has_role('boss') AND status = 'priced')
  OR (has_role('finance') AND status IN ('approved','invoice_ready'))
  OR (has_role('warehouse') AND status IN ('invoice_ready','preparing','ready'))
  OR (has_role('technician') AND status IN ('ready','on_delivery','delivered'))
  OR has_role('tax')
);

CREATE POLICY requests_insert ON requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY requests_update ON requests FOR UPDATE USING (
  user_id = auth.uid()
  OR has_any_role(ARRAY['marketing','boss','finance','warehouse','technician','admin','owner']::user_role[])
);

CREATE POLICY requests_delete ON requests FOR DELETE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.5 REQUEST ITEMS
-- -------------------------------------------------------
CREATE POLICY request_items_select ON request_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM requests r WHERE r.id = request_id)
);

CREATE POLICY request_items_insert ON request_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM requests r WHERE r.id = request_id AND r.user_id = auth.uid())
);

CREATE POLICY request_items_update ON request_items FOR UPDATE
  USING (has_any_role(ARRAY['marketing','finance','admin','owner']::user_role[]));

CREATE POLICY request_items_delete ON request_items FOR DELETE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.6 INVOICES
-- -------------------------------------------------------
CREATE POLICY invoices_select ON invoices FOR SELECT USING (
  has_any_role(ARRAY['finance','admin','owner','tax']::user_role[])
  OR EXISTS (SELECT 1 FROM requests r WHERE r.id = order_id AND r.user_id = auth.uid())
);

CREATE POLICY invoices_manage ON invoices FOR ALL
  USING (has_any_role(ARRAY['finance','admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.7 PAYMENT PROMISES
-- -------------------------------------------------------
CREATE POLICY payment_promises_select ON payment_promises FOR SELECT USING (
  user_id = auth.uid()
  OR has_any_role(ARRAY['finance','admin','owner']::user_role[])
);

CREATE POLICY payment_promises_insert ON payment_promises FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payment_promises_update ON payment_promises FOR UPDATE
  USING (user_id = auth.uid() OR has_any_role(ARRAY['finance','admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.8 DELIVERY LOGS
-- -------------------------------------------------------
CREATE POLICY delivery_logs_select ON delivery_logs FOR SELECT USING (
  technician_id = auth.uid()
  OR has_any_role(ARRAY['admin','owner','warehouse']::user_role[])
  OR EXISTS (SELECT 1 FROM requests r WHERE r.id = order_id AND r.user_id = auth.uid())
);

CREATE POLICY delivery_logs_insert ON delivery_logs FOR INSERT
  WITH CHECK (has_role('technician') AND technician_id = auth.uid());

CREATE POLICY delivery_logs_update ON delivery_logs FOR UPDATE
  USING (technician_id = auth.uid() OR has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.9 INVENTORY LOGS
-- -------------------------------------------------------
CREATE POLICY inventory_logs_select ON inventory_logs FOR SELECT
  USING (has_any_role(ARRAY['warehouse','admin','owner','marketing']::user_role[]));

CREATE POLICY inventory_logs_insert ON inventory_logs FOR INSERT
  WITH CHECK (has_any_role(ARRAY['warehouse','admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.10 ISSUES
-- -------------------------------------------------------
CREATE POLICY issues_select ON issues FOR SELECT USING (
  reported_by = auth.uid()
  OR assigned_to = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
);

CREATE POLICY issues_insert ON issues FOR INSERT
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY issues_update ON issues FOR UPDATE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.11 MONTHLY CLOSING
-- -------------------------------------------------------
CREATE POLICY monthly_closing_select ON monthly_closing FOR SELECT
  USING (has_any_role(ARRAY['finance','admin','owner','tax']::user_role[]));

CREATE POLICY monthly_closing_manage ON monthly_closing FOR ALL
  USING (has_any_role(ARRAY['finance','admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.12 NOTIFICATIONS
-- -------------------------------------------------------
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (true); -- Service functions insert for any user

CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY notifications_delete ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 8.13 CHAT
-- -------------------------------------------------------
CREATE POLICY chat_channels_select ON chat_channels FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_channel_members m WHERE m.channel_id = id AND m.user_id = auth.uid()
  )
  OR has_any_role(ARRAY['admin','owner']::user_role[])
);

CREATE POLICY chat_channels_manage ON chat_channels FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY chat_members_select ON chat_channel_members FOR SELECT USING (
  user_id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
);

CREATE POLICY chat_members_insert ON chat_channel_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY chat_members_update ON chat_channel_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY chat_members_delete ON chat_channel_members FOR DELETE
  USING (user_id = auth.uid() OR has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY chat_messages_select ON chat_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_channel_members m
    WHERE m.channel_id = chat_messages.channel_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM chat_channel_members m
    WHERE m.channel_id = chat_messages.channel_id AND m.user_id = auth.uid()
  )
  AND NOT has_role('client')
);

CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE
  USING (sender_id = auth.uid() OR has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.14 CMS (public read, admin/owner write)
-- -------------------------------------------------------
CREATE POLICY cms_sections_select ON cms_sections FOR SELECT USING (true);
CREATE POLICY cms_sections_manage ON cms_sections FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY cms_media_select ON cms_media FOR SELECT USING (true);
CREATE POLICY cms_media_manage ON cms_media FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY cms_partners_select ON cms_partners FOR SELECT USING (true);
CREATE POLICY cms_partners_manage ON cms_partners FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY cms_solutions_select ON cms_solutions FOR SELECT USING (true);
CREATE POLICY cms_solutions_manage ON cms_solutions FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY eom_select ON employee_of_month FOR SELECT USING (true);
CREATE POLICY eom_manage ON employee_of_month FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.15 ACTIVITY LOGS
-- -------------------------------------------------------
CREATE POLICY activity_logs_select ON activity_logs FOR SELECT USING (
  user_id = auth.uid()
  OR has_any_role(ARRAY['admin','owner']::user_role[])
);

CREATE POLICY activity_logs_insert ON activity_logs FOR INSERT
  WITH CHECK (true);

-- -------------------------------------------------------
-- 8.16 SYSTEM LOGS
-- -------------------------------------------------------
CREATE POLICY system_logs_select ON system_logs FOR SELECT
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY system_logs_insert ON system_logs FOR INSERT
  WITH CHECK (true);

-- -------------------------------------------------------
-- 8.17 BACKUP LOGS
-- -------------------------------------------------------
CREATE POLICY backup_logs_select ON backup_logs FOR SELECT
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY backup_logs_insert ON backup_logs FOR INSERT
  WITH CHECK (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY backup_logs_update ON backup_logs FOR UPDATE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- -------------------------------------------------------
-- 8.18 AUTOMATION
-- -------------------------------------------------------
CREATE POLICY automation_events_select ON automation_events FOR SELECT
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY automation_events_insert ON automation_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY automation_events_update ON automation_events FOR UPDATE
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY automation_webhooks_select ON automation_webhooks FOR SELECT
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY automation_webhooks_manage ON automation_webhooks FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY automation_logs_select ON automation_logs FOR SELECT
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY automation_logs_insert ON automation_logs FOR INSERT
  WITH CHECK (true);

-- -------------------------------------------------------
-- 8.19 EMAIL TEMPLATES
-- -------------------------------------------------------
CREATE POLICY email_templates_select ON email_templates FOR SELECT
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY email_templates_manage ON email_templates FOR ALL
  USING (has_any_role(ARRAY['admin','owner']::user_role[]));

-- ============================================================================
-- 9. ANALYTICS VIEWS
-- ============================================================================

-- 9.1 Monthly Revenue
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT
  to_char(i.created_at, 'YYYY-MM') AS month,
  COUNT(DISTINCT i.id)::integer AS invoice_count,
  COALESCE(SUM(i.total), 0)::numeric(15,2) AS total_revenue,
  COALESCE(SUM(i.tax_amount), 0)::numeric(15,2) AS total_tax,
  COUNT(CASE WHEN i.status = 'paid' THEN 1 END)::integer AS paid_count,
  COUNT(CASE WHEN i.status IN ('issued','overdue') THEN 1 END)::integer AS unpaid_count
FROM invoices i
GROUP BY to_char(i.created_at, 'YYYY-MM')
ORDER BY month DESC;

-- 9.2 Order Pipeline
CREATE OR REPLACE VIEW v_order_pipeline AS
SELECT
  status,
  COUNT(*)::integer AS order_count,
  COALESCE(SUM(total_price), 0)::numeric(15,2) AS total_value,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (now() - updated_at)) / 3600),
    0
  )::numeric(10,2) AS avg_hours_in_status
FROM requests
WHERE status NOT IN ('completed', 'cancelled', 'rejected')
GROUP BY status
ORDER BY
  CASE status
    WHEN 'submitted' THEN 1
    WHEN 'priced' THEN 2
    WHEN 'approved' THEN 3
    WHEN 'invoice_ready' THEN 4
    WHEN 'preparing' THEN 5
    WHEN 'ready' THEN 6
    WHEN 'on_delivery' THEN 7
    WHEN 'delivered' THEN 8
    WHEN 'issue' THEN 9
    WHEN 'resolved' THEN 10
  END;

-- 9.3 Product Performance
CREATE OR REPLACE VIEW v_product_performance AS
SELECT
  p.id,
  p.name,
  p.category::text AS category,
  p.stock,
  COALESCE(SUM(ri.quantity), 0)::integer AS total_ordered,
  COALESCE(SUM(ri.quantity * ri.price_at_order), 0)::numeric(15,2) AS total_revenue,
  COUNT(DISTINCT ri.request_id)::integer AS order_count
FROM products p
LEFT JOIN request_items ri ON ri.product_id = p.id
LEFT JOIN requests r ON r.id = ri.request_id AND r.status NOT IN ('cancelled', 'rejected')
WHERE p.is_active = true
GROUP BY p.id, p.name, p.category, p.stock
ORDER BY total_revenue DESC;

-- 9.4 Technician Performance
CREATE OR REPLACE VIEW v_technician_performance AS
SELECT
  dl.technician_id,
  pr.name AS technician_name,
  COUNT(dl.id)::integer AS total_deliveries,
  COUNT(CASE WHEN dl.status = 'delivered' THEN 1 END)::integer AS successful_deliveries,
  COALESCE(
    AVG(
      CASE WHEN dl.delivered_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (dl.delivered_at - dl.created_at)) / 3600
      END
    ),
    0
  )::numeric(10,2) AS avg_delivery_hours
FROM delivery_logs dl
LEFT JOIN profiles pr ON pr.id = dl.technician_id
GROUP BY dl.technician_id, pr.name
ORDER BY total_deliveries DESC;

-- ============================================================================
-- 10. REALTIME — Enable for key tables
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'notifications','chat_messages','requests','issues',
      'invoices','products','delivery_logs'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 11. STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('products', 'products', true, 5242880, ARRAY['image/png','image/jpeg','image/jpg','image/webp']),
  ('delivery-proofs', 'delivery-proofs', false, 10485760, ARRAY['image/png','image/jpeg','image/jpg','image/webp']),
  ('documents', 'documents', false, 10485760, ARRAY['application/pdf','image/png','image/jpeg','image/jpg']),
  ('chat-files', 'chat-files', false, 10485760, ARRAY['image/png','image/jpeg','image/jpg','image/webp','application/pdf']),
  ('cms-media', 'cms-media', true, 10485760, ARRAY['image/png','image/jpeg','image/jpg','image/webp','video/mp4']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/png','image/jpeg','image/jpg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Drop all existing storage policies so we can recreate cleanly
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol.policyname);
  END LOOP;
END $$;

-- Products bucket: public read, staff write
CREATE POLICY products_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY products_staff_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products'
    AND has_any_role(ARRAY['warehouse','marketing','admin','owner']::user_role[])
  );

CREATE POLICY products_staff_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products'
    AND has_any_role(ARRAY['warehouse','marketing','admin','owner']::user_role[])
  );

CREATE POLICY products_staff_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'products'
    AND has_any_role(ARRAY['admin','owner']::user_role[])
  );

-- Delivery proofs: technician write, staff read
CREATE POLICY delivery_proofs_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'delivery-proofs'
    AND has_any_role(ARRAY['technician','warehouse','admin','owner']::user_role[])
  );

CREATE POLICY delivery_proofs_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND has_role('technician')
  );

-- Documents bucket: finance/admin access
CREATE POLICY documents_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND has_any_role(ARRAY['finance','admin','owner','tax']::user_role[])
  );

CREATE POLICY documents_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND has_any_role(ARRAY['finance','admin','owner']::user_role[])
  );

-- Chat files: staff only (no clients)
CREATE POLICY chat_files_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-files'
    AND auth.uid() IS NOT NULL
    AND NOT has_role('client')
  );

CREATE POLICY chat_files_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-files'
    AND auth.uid() IS NOT NULL
    AND NOT has_role('client')
  );

-- CMS media: public read, admin write
CREATE POLICY cms_media_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'cms-media');

CREATE POLICY cms_media_admin_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cms-media'
    AND has_any_role(ARRAY['admin','owner']::user_role[])
  );

CREATE POLICY cms_media_admin_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cms-media'
    AND has_any_role(ARRAY['admin','owner']::user_role[])
  );

CREATE POLICY cms_media_admin_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cms-media'
    AND has_any_role(ARRAY['admin','owner']::user_role[])
  );

-- Avatars: public read, own write
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY avatars_own_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

-- ============================================================================
-- 12. SEED DATA — Default Chat Channels
-- ============================================================================

INSERT INTO chat_channels (name, channel_type, description) VALUES
  ('General', 'general', 'Company-wide announcements and discussion'),
  ('Marketing', 'marketing', 'Marketing team channel'),
  ('Finance', 'finance', 'Finance team channel'),
  ('Warehouse', 'warehouse', 'Warehouse operations channel'),
  ('Technician', 'technician', 'Field technician channel'),
  ('Admin', 'admin', 'System administrators channel'),
  ('Owner', 'owner', 'Executive leadership channel')
ON CONFLICT (channel_type) DO NOTHING;

-- ============================================================================
-- 13. SEED DATA — Default CMS Sections
-- ============================================================================

INSERT INTO cms_sections (section_key, title, subtitle, body, sort_order, is_visible) VALUES
  ('hero', 'Precision Laboratory Systems', 'Equipment, reagents, and technical support for laboratories across Indonesia.', 'PT SMS Lab menyediakan peralatan laboratorium berkualitas tinggi dengan layanan purna jual terbaik.', 1, true),
  ('about', 'Real Experience. Real Reliability.', 'Leading laboratory equipment supplier in Indonesia', 'We understand laboratory workflows — not just from theory, but from real operational experience. Our team brings hands-on knowledge of equipment installation, daily operations, maintenance challenges, and troubleshooting under pressure.', 2, true),
  ('services', 'Complete Laboratory Solutions', 'From equipment to consumables to full-service support — everything your lab needs to operate reliably.', NULL, 3, true),
  ('products_highlight', 'Featured Products', 'Top quality equipment', NULL, 4, true),
  ('business_model', 'Flexible Business Models', 'How we serve you', NULL, 5, true),
  ('trust', 'Technicians Available 24/7', 'Trusted by hundreds of institutions', NULL, 6, true),
  ('partners', 'Trusted Partners', 'Working with leading laboratory equipment manufacturers', NULL, 7, true),
  ('cta', 'Ready to discuss your laboratory needs?', 'Our team is ready to help you find the best solution.', NULL, 8, true),
  ('footer', 'PT Sarana Medika Sejahtera', NULL, 'Jl. Lab Raya No. 123, Bogor, Indonesia | Tel: (0251) 123-4567', 9, true),
  ('announcement_banner', 'Announcement', NULL, NULL, 0, false),
  ('company_info', 'PT Sarana Medika Sejahtera', NULL, NULL, 0, true),
  ('employee_of_month', 'Employee of the Month', NULL, NULL, 0, true)
ON CONFLICT (section_key) DO NOTHING;

-- ============================================================================
-- 14. SEED DATA — Default Email Templates
-- ============================================================================

INSERT INTO email_templates (name, subject, body_html, variables, is_active) VALUES
  ('request_created', 'Order Baru: {{orderId}}', '<h2>Order Baru Diterima</h2><p>Order <b>{{orderId}}</b> telah dibuat oleh {{customerName}}.</p><p>Total item: {{itemCount}}</p>', ARRAY['orderId','customerName','itemCount'], true),
  ('request_approved', 'Order Disetujui: {{orderId}}', '<h2>Order Disetujui</h2><p>Order <b>{{orderId}}</b> telah disetujui.</p><p>Total: Rp {{totalPrice}}</p>', ARRAY['orderId','totalPrice'], true),
  ('request_rejected', 'Order Ditolak: {{orderId}}', '<h2>Order Ditolak</h2><p>Order <b>{{orderId}}</b> telah ditolak.</p><p>Alasan: {{reason}}</p>', ARRAY['orderId','reason'], true),
  ('invoice_created', 'Invoice Baru: {{invoiceNumber}}', '<h2>Invoice Baru</h2><p>Invoice <b>{{invoiceNumber}}</b> untuk order {{orderId}}.</p><p>Total: Rp {{total}}</p><p>Jatuh tempo: {{dueDate}}</p>', ARRAY['invoiceNumber','orderId','total','dueDate'], true),
  ('invoice_paid', 'Pembayaran Diterima: {{invoiceNumber}}', '<h2>Pembayaran Diterima</h2><p>Invoice <b>{{invoiceNumber}}</b> telah dibayar.</p><p>Metode: {{paymentMethod}}</p>', ARRAY['invoiceNumber','paymentMethod'], true),
  ('order_delivered', 'Order Terkirim: {{orderId}}', '<h2>Order Terkirim</h2><p>Order <b>{{orderId}}</b> telah berhasil dikirim.</p><p>Teknisi: {{technicianName}}</p>', ARRAY['orderId','technicianName'], true),
  ('order_ready', 'Order Siap Kirim: {{orderId}}', '<h2>Order Siap Dikirim</h2><p>Order <b>{{orderId}}</b> telah siap untuk dikirim.</p>', ARRAY['orderId'], true),
  ('issue_created', 'Laporan Masalah: {{orderId}}', '<h2>Masalah Dilaporkan</h2><p>Masalah baru pada order <b>{{orderId}}</b>.</p><p>Deskripsi: {{description}}</p>', ARRAY['orderId','description'], true),
  ('issue_resolved', 'Masalah Diselesaikan: {{orderId}}', '<h2>Masalah Diselesaikan</h2><p>Masalah pada order <b>{{orderId}}</b> telah diselesaikan.</p><p>Resolusi: {{resolution}}</p>', ARRAY['orderId','resolution'], true),
  ('monthly_report', 'Laporan Bulanan: {{monthLabel}}', '<h2>Laporan Bulanan</h2><p>Laporan penjualan untuk periode <b>{{monthLabel}}</b>.</p><p>Total penjualan: Rp {{totalSales}}</p><p>Invoice terbayar: {{paidCount}}</p>', ARRAY['monthLabel','totalSales','paidCount'], true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
