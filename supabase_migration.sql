-- ============================================================================
-- WEBSMS ERP SYSTEM — COMPLETE DATABASE MIGRATION
-- Version: 2.0.0
-- Description: Production-grade enterprise ERP database schema
-- Supports: Auth, RBAC, Workflow, Inventory, Finance, Delivery, Chat,
--           Notifications, CMS, Analytics, Logging, File Storage
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";  -- trigram search for fast LIKE queries

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================
do $$ begin
  create type user_role as enum (
    'client','marketing','boss','finance','warehouse',
    'technician','admin','owner','tax'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type client_type as enum ('regular','kso');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type request_status as enum (
    'submitted','priced','approved','invoice_ready',
    'preparing','ready','on_delivery','delivered',
    'completed','issue','resolved','cancelled','rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type request_priority as enum ('normal','cito');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invoice_status as enum ('draft','issued','paid','overdue','cancelled','credited');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notification_type as enum ('info','success','warning','error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type issue_status as enum ('open','in_progress','resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type log_level as enum ('info','warning','error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type chat_channel_type as enum (
    'general','marketing','finance','warehouse',
    'technician','admin','owner'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type product_category as enum (
    'Equipment','Consumables','Service & Support','Reagents','Service'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type backup_type as enum ('database','storage','full');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type backup_status as enum ('pending','completed','failed','verified','restored','partial');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type automation_status as enum ('pending','processed','failed');
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- 2. UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update updated_at on every row modification
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper: get the current user's role from profiles
create or replace function auth_user_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: check if user has a specific role
create or replace function has_role(required_role user_role)
returns boolean as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = required_role
  );
$$ language sql security definer stable;

-- Helper: check if user has any of the given roles
create or replace function has_any_role(required_roles user_role[])
returns boolean as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = any(required_roles)
  );
$$ language sql security definer stable;

-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 PROFILES
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'client',
  name        text,
  phone       text,
  address     text,
  client_type client_type default 'regular',
  pic_name    text,
  company     text,
  avatar_url  text,
  debt_amount numeric(15,2) not null default 0,
  debt_limit  numeric(15,2) not null default 500000,
  two_factor_secret text,
  two_factor_enabled boolean not null default false,
  is_active   boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id)
);

create unique index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_is_active on profiles(is_active);
create index if not exists idx_profiles_client_type on profiles(client_type) where client_type is not null;

-- ---------------------------------------------------------------------------
-- 3.2 PRODUCTS
-- ---------------------------------------------------------------------------
create table if not exists products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  sku         text,
  category    product_category,
  image_url   text,
  stock       integer not null default 0 check (stock >= 0),
  min_stock   integer not null default 5,
  unit        text not null default 'pcs',
  is_active   boolean not null default true,
  is_priced   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id)
);

create unique index if not exists idx_products_sku on products(sku) where sku is not null;
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_is_active on products(is_active);
create index if not exists idx_products_is_priced on products(is_priced);
create index if not exists idx_products_name_trgm on products using gin(name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3.3 PRICE LIST
-- ---------------------------------------------------------------------------
create table if not exists price_list (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id) on delete cascade,
  price_regular numeric(15,2) not null default 0 check (price_regular >= 0),
  price_kso   numeric(15,2) not null default 0 check (price_kso >= 0),
  effective_from timestamptz not null default now(),
  effective_to   timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id)
);

create index if not exists idx_price_list_product on price_list(product_id);
create index if not exists idx_price_list_active on price_list(is_active, effective_from);

-- ---------------------------------------------------------------------------
-- 3.4 REQUESTS (Orders)
-- ---------------------------------------------------------------------------
create table if not exists requests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id),
  user_email    text,
  status        request_status not null default 'submitted',
  priority      request_priority not null default 'normal',
  total_price   numeric(15,2) not null default 0,
  note          text,
  invoice_id    uuid,
  assigned_technician_id uuid references auth.users(id),
  rejection_reason text,
  priced_at     timestamptz,
  approved_at   timestamptz,
  rejected_at   timestamptz,
  invoice_ready_at timestamptz,
  preparing_at  timestamptz,
  ready_at      timestamptz,
  on_delivery_at timestamptz,
  delivered_at  timestamptz,
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id)
);

create index if not exists idx_requests_user on requests(user_id);
create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_priority on requests(priority);
create index if not exists idx_requests_created on requests(created_at desc);
create index if not exists idx_requests_technician on requests(assigned_technician_id) where assigned_technician_id is not null;
create index if not exists idx_requests_status_created on requests(status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3.5 REQUEST ITEMS
-- ---------------------------------------------------------------------------
create table if not exists request_items (
  id            uuid primary key default uuid_generate_v4(),
  request_id    uuid not null references requests(id) on delete cascade,
  product_id    uuid not null references products(id),
  quantity      integer not null default 1 check (quantity > 0),
  price_at_order numeric(15,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_request_items_request on request_items(request_id);
create index if not exists idx_request_items_product on request_items(product_id);

-- ---------------------------------------------------------------------------
-- 3.6 INVOICES
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references requests(id),
  invoice_number  text not null,
  subtotal        numeric(15,2) not null default 0,
  tax_rate        numeric(5,4) not null default 0.11,
  tax_amount      numeric(15,2) not null default 0,
  total           numeric(15,2) not null default 0,
  status          invoice_status not null default 'draft',
  issued_at       timestamptz,
  due_date        timestamptz,
  paid_at         timestamptz,
  payment_method  text,
  payment_ref     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id)
);

create unique index if not exists idx_invoices_number on invoices(invoice_number);
create index if not exists idx_invoices_order on invoices(order_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_due_date on invoices(due_date) where status in ('issued','overdue');

-- Link requests.invoice_id → invoices
alter table requests drop constraint if exists fk_requests_invoice;
alter table requests add constraint fk_requests_invoice
  foreign key (invoice_id) references invoices(id);

-- ---------------------------------------------------------------------------
-- 3.7 PAYMENT PROMISES
-- ---------------------------------------------------------------------------
create table if not exists payment_promises (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id),
  user_email  text,
  request_id  uuid references requests(id),
  promise_date timestamptz not null,
  note        text,
  fulfilled   boolean not null default false,
  fulfilled_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_payment_promises_user on payment_promises(user_id);
create index if not exists idx_payment_promises_request on payment_promises(request_id) where request_id is not null;

-- ---------------------------------------------------------------------------
-- 3.8 DELIVERY LOGS
-- ---------------------------------------------------------------------------
create table if not exists delivery_logs (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references requests(id),
  technician_id   uuid not null references auth.users(id),
  status          text not null default 'delivered',
  note            text,
  proof_url       text,
  signature_url   text,
  delivered_at    timestamptz,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_delivery_logs_order on delivery_logs(order_id);
create index if not exists idx_delivery_logs_technician on delivery_logs(technician_id);

-- ---------------------------------------------------------------------------
-- 3.9 INVENTORY LOGS
-- ---------------------------------------------------------------------------
create table if not exists inventory_logs (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id),
  order_id    uuid references requests(id),
  change      integer not null,
  balance     integer not null default 0,
  reason      text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_inventory_logs_product on inventory_logs(product_id);
create index if not exists idx_inventory_logs_order on inventory_logs(order_id) where order_id is not null;
create index if not exists idx_inventory_logs_created on inventory_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- 3.10 ISSUES
-- ---------------------------------------------------------------------------
create table if not exists issues (
  id            uuid primary key default uuid_generate_v4(),
  order_id      uuid not null references requests(id),
  reported_by   uuid not null references auth.users(id),
  assigned_to   uuid references auth.users(id),
  description   text not null,
  status        issue_status not null default 'open',
  resolution    text,
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_issues_order on issues(order_id);
create index if not exists idx_issues_status on issues(status);
create index if not exists idx_issues_reported_by on issues(reported_by);

-- ---------------------------------------------------------------------------
-- 3.11 MONTHLY CLOSING
-- ---------------------------------------------------------------------------
create table if not exists monthly_closing (
  id              uuid primary key default uuid_generate_v4(),
  month           integer not null check (month between 1 and 12),
  year            integer not null check (year >= 2020),
  total_revenue   numeric(15,2) not null default 0,
  total_tax       numeric(15,2) not null default 0,
  orders_count    integer not null default 0,
  paid_invoices   integer not null default 0,
  unpaid_invoices integer not null default 0,
  closed_by       uuid references auth.users(id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_monthly_closing_period on monthly_closing(year, month);

-- ============================================================================
-- 4. NOTIFICATION SYSTEM
-- ============================================================================

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  message     text not null,
  type        notification_type not null default 'info',
  read        boolean not null default false,
  read_at     timestamptz,
  order_id    uuid references requests(id),
  action_url  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_unread on notifications(user_id, read) where read = false;
create index if not exists idx_notifications_created on notifications(created_at desc);

-- ============================================================================
-- 5. INTERNAL CHAT SYSTEM
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 CHAT CHANNELS
-- ---------------------------------------------------------------------------
create table if not exists chat_channels (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  channel_type  chat_channel_type not null default 'general',
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists idx_chat_channels_type on chat_channels(channel_type);

-- Seed default channels
insert into chat_channels (name, channel_type, description) values
  ('General', 'general', 'Company-wide announcements and discussion'),
  ('Marketing', 'marketing', 'Marketing team channel'),
  ('Finance', 'finance', 'Finance team channel'),
  ('Warehouse', 'warehouse', 'Warehouse operations channel'),
  ('Technician', 'technician', 'Field technician channel'),
  ('Admin', 'admin', 'System administrators channel'),
  ('Owner', 'owner', 'Executive leadership channel')
on conflict (channel_type) do nothing;

-- ---------------------------------------------------------------------------
-- 5.2 CHAT CHANNEL MEMBERS
-- ---------------------------------------------------------------------------
create table if not exists chat_channel_members (
  id          uuid primary key default uuid_generate_v4(),
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  last_read_at timestamptz not null default now()
);

create unique index if not exists idx_channel_members_unique on chat_channel_members(channel_id, user_id);
create index if not exists idx_channel_members_user on chat_channel_members(user_id);

-- ---------------------------------------------------------------------------
-- 5.3 CHAT MESSAGES
-- ---------------------------------------------------------------------------
create table if not exists chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  sender_id   uuid not null references auth.users(id),
  content     text not null,
  file_url    text,
  file_name   text,
  file_type   text,
  is_edited   boolean not null default false,
  is_deleted  boolean not null default false,
  reply_to    uuid references chat_messages(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_chat_messages_channel on chat_messages(channel_id, created_at desc);
create index if not exists idx_chat_messages_sender on chat_messages(sender_id);

-- ============================================================================
-- 6. CMS SYSTEM (Content Management)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 6.1 CMS SECTIONS — each section of the website is editable
-- ---------------------------------------------------------------------------
create table if not exists cms_sections (
  id          uuid primary key default uuid_generate_v4(),
  section_key text not null,
  title       text,
  subtitle    text,
  body        text,
  image_url   text,
  video_url   text,
  cta_text    text,
  cta_link    text,
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

create unique index if not exists idx_cms_sections_key on cms_sections(section_key);

-- Seed default CMS sections
insert into cms_sections (section_key, title, subtitle, sort_order) values
  ('hero', 'PT Sarana Medika Sejahtera', 'Your Trusted Laboratory Equipment Partner', 1),
  ('about', 'About Us', 'Leading laboratory equipment supplier in Indonesia', 2),
  ('solutions', 'Our Solutions', 'Comprehensive laboratory solutions', 3),
  ('products_highlight', 'Featured Products', 'Top quality equipment', 4),
  ('business_model', 'Business Model', 'How we serve you', 5),
  ('trust', 'Why Trust Us', 'Trusted by hundreds of institutions', 6),
  ('partners', 'Our Partners', 'Working with world-class brands', 7),
  ('contact', 'Contact Us', 'Get in touch with our team', 8),
  ('announcement_banner', 'Announcement', null, 0),
  ('company_info', 'PT Sarana Medika Sejahtera', null, 0),
  ('employee_of_month', 'Employee of the Month', null, 0)
on conflict (section_key) do nothing;

-- ---------------------------------------------------------------------------
-- 6.2 CMS MEDIA — managed images, videos, banners
-- ---------------------------------------------------------------------------
create table if not exists cms_media (
  id          uuid primary key default uuid_generate_v4(),
  section_id  uuid references cms_sections(id) on delete set null,
  title       text,
  alt_text    text,
  file_url    text not null,
  file_type   text not null, -- 'image', 'video'
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  uploaded_by uuid references auth.users(id)
);

create index if not exists idx_cms_media_section on cms_media(section_id);

-- ---------------------------------------------------------------------------
-- 6.3 CMS PARTNERS
-- ---------------------------------------------------------------------------
create table if not exists cms_partners (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  logo_url    text not null,
  website_url text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6.4 CMS SOLUTIONS
-- ---------------------------------------------------------------------------
create table if not exists cms_solutions (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null,
  title       text not null,
  description text,
  category    product_category,
  image_url   text,
  specs       jsonb default '[]',
  use_case    text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_cms_solutions_slug on cms_solutions(slug);

-- ---------------------------------------------------------------------------
-- 6.5 EMPLOYEE OF THE MONTH
-- ---------------------------------------------------------------------------
create table if not exists employee_of_month (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id),
  month       integer not null check (month between 1 and 12),
  year        integer not null check (year >= 2020),
  reason      text,
  photo_url   text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create unique index if not exists idx_eom_period on employee_of_month(year, month);

-- ============================================================================
-- 7. LOGGING & ANALYTICS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7.1 ACTIVITY LOGS — user actions audit trail
-- ---------------------------------------------------------------------------
create table if not exists activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id),
  user_email  text,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb default '{}',
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_logs_user on activity_logs(user_id);
create index if not exists idx_activity_logs_entity on activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_action on activity_logs(action);
create index if not exists idx_activity_logs_created on activity_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- 7.2 SYSTEM LOGS — service-level operational logs
-- ---------------------------------------------------------------------------
create table if not exists system_logs (
  id          uuid primary key default uuid_generate_v4(),
  level       log_level not null default 'info',
  service     text not null,
  action      text not null,
  message     text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_system_logs_level on system_logs(level);
create index if not exists idx_system_logs_service on system_logs(service);
create index if not exists idx_system_logs_created on system_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- 7.3 BACKUP LOGS
-- ---------------------------------------------------------------------------
create table if not exists backup_logs (
  id            uuid primary key default uuid_generate_v4(),
  backup_type   backup_type not null,
  file_url      text,
  status        backup_status not null default 'pending',
  size          bigint,
  notes         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_backup_logs_status on backup_logs(status);

-- ============================================================================
-- 8. AUTOMATION SYSTEM
-- ============================================================================

create table if not exists automation_events (
  id            uuid primary key default uuid_generate_v4(),
  event_type    text not null,
  payload       jsonb default '{}',
  status        automation_status not null default 'pending',
  retry_count   integer not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists idx_automation_events_status on automation_events(status);
create index if not exists idx_automation_events_type on automation_events(event_type);

create table if not exists automation_webhooks (
  id          uuid primary key default uuid_generate_v4(),
  event_type  text not null,
  webhook_url text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists automation_logs (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid references automation_events(id),
  webhook_url text,
  status      text not null,
  response    text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 9. EMAIL TEMPLATES
-- ============================================================================

create table if not exists email_templates (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  subject     text not null,
  body_html   text not null,
  variables   jsonb default '[]',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_email_templates_name on email_templates(name);

-- ============================================================================
-- 10. UPDATED_AT TRIGGERS
-- ============================================================================

do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'profiles','products','price_list','requests','request_items',
      'invoices','payment_promises','delivery_logs','issues',
      'monthly_closing','chat_channels','chat_messages',
      'cms_sections','cms_media','cms_partners','cms_solutions',
      'email_templates'
    ])
  loop
    execute format(
      'drop trigger if exists trg_%s_updated_at on %I; '
      'create trigger trg_%s_updated_at '
      'before update on %I for each row execute function update_updated_at();',
      tbl, tbl, tbl, tbl
    );
  end loop;
end $$;

-- ============================================================================
-- 11. BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 11.1 ATOMIC STOCK DECREMENT — prevents overselling
-- ---------------------------------------------------------------------------
create or replace function decrement_stock(p_product_id uuid, p_qty integer)
returns integer as $$
declare
  new_stock integer;
begin
  update products
    set stock = stock - p_qty,
        updated_at = now()
  where id = p_product_id
    and stock >= p_qty
  returning stock into new_stock;

  if not found then
    raise exception 'Insufficient stock for product %', p_product_id;
  end if;

  return new_stock;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 11.2 ATOMIC STOCK INCREMENT
-- ---------------------------------------------------------------------------
create or replace function increment_stock(p_product_id uuid, p_qty integer)
returns integer as $$
declare
  new_stock integer;
begin
  update products
    set stock = stock + p_qty,
        updated_at = now()
  where id = p_product_id
  returning stock into new_stock;

  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  return new_stock;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 11.3 GENERATE INVOICE NUMBER (sequence-based, no race conditions)
-- ---------------------------------------------------------------------------
create sequence if not exists invoice_number_seq start 1;

create or replace function generate_invoice_number()
returns text as $$
declare
  seq_val integer;
  yr text;
  mn text;
begin
  seq_val := nextval('invoice_number_seq');
  yr := to_char(now(), 'YYYY');
  mn := to_char(now(), 'MM');
  return format('INV/%s/%s/%s', yr, mn, lpad(seq_val::text, 5, '0'));
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 11.4 NOTIFICATION COUNT FOR USER
-- ---------------------------------------------------------------------------
create or replace function unread_notification_count(p_user_id uuid)
returns bigint as $$
  select count(*) from notifications
  where user_id = p_user_id and read = false;
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- 11.5 UNREAD CHAT COUNT FOR USER
-- ---------------------------------------------------------------------------
create or replace function unread_chat_count(p_user_id uuid)
returns bigint as $$
  select count(*) from chat_messages m
  inner join chat_channel_members cm on cm.channel_id = m.channel_id and cm.user_id = p_user_id
  where m.created_at > cm.last_read_at
    and m.sender_id != p_user_id
    and m.is_deleted = false;
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- 11.6 AUTO-JOIN CHAT CHANNELS BASED ON ROLE
-- ---------------------------------------------------------------------------
create or replace function auto_join_chat_channels()
returns trigger as $$
declare
  role_channel chat_channel_type;
begin
  -- Everyone joins general
  insert into chat_channel_members (channel_id, user_id)
  select id, new.id from chat_channels where channel_type = 'general'
  on conflict do nothing;

  -- Join role-specific channel
  if new.role in ('marketing','finance','warehouse','technician','admin','owner') then
    role_channel := new.role::chat_channel_type;
    insert into chat_channel_members (channel_id, user_id)
    select id, new.id from chat_channels where channel_type = role_channel
    on conflict do nothing;
  end if;

  -- Owner and admin see all channels
  if new.role in ('owner','admin') then
    insert into chat_channel_members (channel_id, user_id)
    select id, new.id from chat_channels where is_active = true
    on conflict do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_join_chat on profiles;
create trigger trg_auto_join_chat
  after insert or update of role on profiles
  for each row execute function auto_join_chat_channels();

-- ---------------------------------------------------------------------------
-- 11.7 PRODUCT IS_PRICED SYNC
-- ---------------------------------------------------------------------------
create or replace function sync_product_is_priced()
returns trigger as $$
begin
  update products set is_priced = true, updated_at = now()
  where id = new.product_id
    and not is_priced
    and new.is_active = true
    and (new.price_regular > 0 or new.price_kso > 0);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_priced on price_list;
create trigger trg_sync_priced
  after insert or update on price_list
  for each row execute function sync_product_is_priced();

-- ---------------------------------------------------------------------------
-- 11.8 AUTO-CREATE NOTIFICATION ON REQUEST STATUS CHANGE
-- ---------------------------------------------------------------------------
create or replace function notify_on_request_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    -- Notify the request owner
    insert into notifications (user_id, title, message, type, order_id)
    values (
      new.user_id,
      'Order Status Updated',
      format('Your order has been updated to: %s', new.status::text),
      'info',
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_request_change on requests;
create trigger trg_notify_request_change
  after update of status on requests
  for each row execute function notify_on_request_change();

-- ---------------------------------------------------------------------------
-- 11.9 AUTO-LOG ACTIVITY ON REQUEST STATUS CHANGE
-- ---------------------------------------------------------------------------
create or replace function log_request_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (
      coalesce(new.updated_by, auth.uid()),
      'status_change',
      'request',
      new.id::text,
      jsonb_build_object(
        'previous_status', old.status::text,
        'new_status', new.status::text,
        'updated_at', new.updated_at
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_request_status on requests;
create trigger trg_log_request_status
  after update of status on requests
  for each row execute function log_request_status_change();

-- ---------------------------------------------------------------------------
-- 11.10 LOW STOCK ALERT
-- ---------------------------------------------------------------------------
create or replace function check_low_stock()
returns trigger as $$
begin
  if new.stock <= new.min_stock and (old.stock is null or old.stock > old.min_stock) then
    -- Notify warehouse and admin
    insert into notifications (user_id, title, message, type)
    select p.id, 'Low Stock Alert',
      format('Product "%s" is low on stock (%s remaining)', new.name, new.stock),
      'warning'
    from profiles p
    where p.role in ('warehouse','admin','owner') and p.is_active = true;

    -- Create automation event
    insert into automation_events (event_type, payload)
    values ('low_stock', jsonb_build_object(
      'product_id', new.id,
      'product_name', new.name,
      'current_stock', new.stock,
      'min_stock', new.min_stock
    ));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_low_stock on products;
create trigger trg_low_stock
  after update of stock on products
  for each row execute function check_low_stock();

-- ---------------------------------------------------------------------------
-- 11.11 OVERDUE INVOICE CHECK
-- ---------------------------------------------------------------------------
create or replace function check_overdue_invoices()
returns void as $$
begin
  update invoices
    set status = 'overdue', updated_at = now()
  where status = 'issued'
    and due_date < now();

  -- Notify finance about overdue invoices
  insert into notifications (user_id, title, message, type, order_id)
  select p.id, 'Overdue Invoice',
    format('Invoice %s is overdue', i.invoice_number),
    'warning', i.order_id
  from invoices i
  cross join profiles p
  where i.status = 'overdue'
    and p.role in ('finance','owner')
    and p.is_active = true
    and not exists (
      select 1 from notifications n
      where n.order_id = i.order_id
        and n.title = 'Overdue Invoice'
        and n.created_at > now() - interval '1 day'
    );
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 12. ANALYTICS VIEWS (materialized for performance)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 12.1 MONTHLY REVENUE SUMMARY
-- ---------------------------------------------------------------------------
create or replace view v_monthly_revenue as
select
  date_trunc('month', i.created_at) as month,
  count(distinct i.id) as invoice_count,
  sum(i.total) as total_revenue,
  sum(i.tax_amount) as total_tax,
  count(case when i.status = 'paid' then 1 end) as paid_count,
  count(case when i.status in ('issued','overdue') then 1 end) as unpaid_count
from invoices i
group by date_trunc('month', i.created_at);

-- ---------------------------------------------------------------------------
-- 12.2 ORDER PIPELINE SUMMARY
-- ---------------------------------------------------------------------------
create or replace view v_order_pipeline as
select
  status,
  count(*) as order_count,
  sum(total_price) as total_value,
  avg(extract(epoch from (updated_at - created_at))/3600)::numeric(10,1) as avg_hours_in_status
from requests
where status not in ('cancelled','rejected')
group by status;

-- ---------------------------------------------------------------------------
-- 12.3 PRODUCT PERFORMANCE
-- ---------------------------------------------------------------------------
create or replace view v_product_performance as
select
  p.id,
  p.name,
  p.category,
  p.stock,
  coalesce(sum(ri.quantity), 0) as total_ordered,
  coalesce(sum(ri.price_at_order * ri.quantity), 0) as total_revenue,
  count(distinct ri.request_id) as order_count
from products p
left join request_items ri on ri.product_id = p.id
group by p.id, p.name, p.category, p.stock;

-- ---------------------------------------------------------------------------
-- 12.4 TECHNICIAN PERFORMANCE
-- ---------------------------------------------------------------------------
create or replace view v_technician_performance as
select
  dl.technician_id,
  pr.name as technician_name,
  count(*) as total_deliveries,
  count(case when dl.status = 'delivered' then 1 end) as successful_deliveries,
  avg(extract(epoch from (dl.delivered_at - dl.created_at))/3600)::numeric(10,1) as avg_delivery_hours
from delivery_logs dl
left join profiles pr on pr.id = dl.technician_id
group by dl.technician_id, pr.name;

-- ============================================================================
-- 13. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'profiles','products','price_list','requests','request_items',
      'invoices','payment_promises','delivery_logs','inventory_logs',
      'issues','monthly_closing','notifications','chat_channels',
      'chat_channel_members','chat_messages','cms_sections','cms_media',
      'cms_partners','cms_solutions','employee_of_month','activity_logs',
      'system_logs','backup_logs','automation_events','automation_webhooks',
      'automation_logs','email_templates'
    ])
  loop
    execute format('alter table %I enable row level security;', tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 13.1 PROFILES
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (
  id = auth.uid()                                     -- own profile
  or has_any_role(array['admin','owner']::user_role[]) -- admin/owner see all
  or (has_role('marketing') and role = 'client')       -- marketing sees clients
);

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update using (
  id = auth.uid()
) with check (id = auth.uid());

drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles for update using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "profiles_insert" on profiles;
create policy "profiles_insert" on profiles for insert with check (
  id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- 13.2 PRODUCTS
-- ---------------------------------------------------------------------------
drop policy if exists "products_select" on products;
create policy "products_select" on products for select using (true); -- public catalog

drop policy if exists "products_insert" on products;
create policy "products_insert" on products for insert with check (
  has_any_role(array['warehouse','admin','owner','marketing']::user_role[])
);

drop policy if exists "products_update" on products;
create policy "products_update" on products for update using (
  has_any_role(array['warehouse','admin','owner','marketing']::user_role[])
);

drop policy if exists "products_delete" on products;
create policy "products_delete" on products for delete using (
  has_any_role(array['admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.3 PRICE LIST
-- ---------------------------------------------------------------------------
drop policy if exists "price_list_select" on price_list;
create policy "price_list_select" on price_list for select using (
  has_any_role(array['marketing','finance','boss','admin','owner','tax']::user_role[])
  or (has_role('client') and is_active = true) -- clients only see active prices
);

drop policy if exists "price_list_manage" on price_list;
create policy "price_list_manage" on price_list for all using (
  has_any_role(array['marketing','admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.4 REQUESTS
-- ---------------------------------------------------------------------------
drop policy if exists "requests_select" on requests;
create policy "requests_select" on requests for select using (
  user_id = auth.uid()                                  -- own requests
  or has_any_role(array['admin','owner']::user_role[])  -- admin/owner see all
  or (has_role('marketing') and status = 'submitted')
  or (has_role('boss') and status = 'priced')
  or (has_role('finance') and status in ('approved','invoice_ready'))
  or (has_role('warehouse') and status in ('invoice_ready','preparing','ready'))
  or (has_role('technician') and status in ('ready','on_delivery','delivered'))
  or (has_role('tax'))  -- tax sees all for reporting
);

drop policy if exists "requests_insert" on requests;
create policy "requests_insert" on requests for insert with check (
  user_id = auth.uid()
);

drop policy if exists "requests_update" on requests;
create policy "requests_update" on requests for update using (
  user_id = auth.uid()
  or has_any_role(array['marketing','boss','finance','warehouse','technician','admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.5 REQUEST ITEMS
-- ---------------------------------------------------------------------------
drop policy if exists "request_items_select" on request_items;
create policy "request_items_select" on request_items for select using (
  exists (
    select 1 from requests r where r.id = request_id
  ) -- inherits from requests RLS
);

drop policy if exists "request_items_insert" on request_items;
create policy "request_items_insert" on request_items for insert with check (
  exists (
    select 1 from requests r where r.id = request_id and r.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 13.6 INVOICES
-- ---------------------------------------------------------------------------
drop policy if exists "invoices_select" on invoices;
create policy "invoices_select" on invoices for select using (
  has_any_role(array['finance','admin','owner','tax']::user_role[])
  or exists (
    select 1 from requests r where r.id = order_id and r.user_id = auth.uid()
  )
);

drop policy if exists "invoices_manage" on invoices;
create policy "invoices_manage" on invoices for all using (
  has_any_role(array['finance','admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.7 PAYMENT PROMISES
-- ---------------------------------------------------------------------------
drop policy if exists "payment_promises_select" on payment_promises;
create policy "payment_promises_select" on payment_promises for select using (
  user_id = auth.uid()
  or has_any_role(array['finance','admin','owner']::user_role[])
);

drop policy if exists "payment_promises_insert" on payment_promises;
create policy "payment_promises_insert" on payment_promises for insert with check (
  user_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- 13.8 DELIVERY LOGS
-- ---------------------------------------------------------------------------
drop policy if exists "delivery_logs_select" on delivery_logs;
create policy "delivery_logs_select" on delivery_logs for select using (
  technician_id = auth.uid()
  or has_any_role(array['admin','owner','warehouse']::user_role[])
  or exists (
    select 1 from requests r where r.id = order_id and r.user_id = auth.uid()
  )
);

drop policy if exists "delivery_logs_insert" on delivery_logs;
create policy "delivery_logs_insert" on delivery_logs for insert with check (
  has_role('technician') and technician_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- 13.9 INVENTORY LOGS
-- ---------------------------------------------------------------------------
drop policy if exists "inventory_logs_select" on inventory_logs;
create policy "inventory_logs_select" on inventory_logs for select using (
  has_any_role(array['warehouse','admin','owner']::user_role[])
);

drop policy if exists "inventory_logs_insert" on inventory_logs;
create policy "inventory_logs_insert" on inventory_logs for insert with check (
  has_any_role(array['warehouse','admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.10 ISSUES
-- ---------------------------------------------------------------------------
drop policy if exists "issues_select" on issues;
create policy "issues_select" on issues for select using (
  reported_by = auth.uid()
  or has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "issues_insert" on issues;
create policy "issues_insert" on issues for insert with check (
  reported_by = auth.uid()
);

drop policy if exists "issues_update" on issues;
create policy "issues_update" on issues for update using (
  has_any_role(array['admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.11 MONTHLY CLOSING
-- ---------------------------------------------------------------------------
drop policy if exists "monthly_closing_select" on monthly_closing;
create policy "monthly_closing_select" on monthly_closing for select using (
  has_any_role(array['finance','owner','tax']::user_role[])
);

drop policy if exists "monthly_closing_manage" on monthly_closing;
create policy "monthly_closing_manage" on monthly_closing for all using (
  has_any_role(array['finance','admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.12 NOTIFICATIONS
-- ---------------------------------------------------------------------------
drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select using (
  user_id = auth.uid()
);

drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert with check (true);
-- Service functions insert notifications for any user (security definer)

drop policy if exists "notifications_update" on notifications;
create policy "notifications_update" on notifications for update using (
  user_id = auth.uid() -- can only mark own as read
);

-- ---------------------------------------------------------------------------
-- 13.13 CHAT
-- ---------------------------------------------------------------------------
drop policy if exists "chat_channels_select" on chat_channels;
create policy "chat_channels_select" on chat_channels for select using (
  exists (
    select 1 from chat_channel_members m where m.channel_id = id and m.user_id = auth.uid()
  )
  or has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "chat_channel_members_select" on chat_channel_members;
create policy "chat_channel_members_select" on chat_channel_members for select using (
  user_id = auth.uid()
  or has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "chat_channel_members_update" on chat_channel_members;
create policy "chat_channel_members_update" on chat_channel_members for update using (
  user_id = auth.uid()
);

drop policy if exists "chat_messages_select" on chat_messages;
create policy "chat_messages_select" on chat_messages for select using (
  exists (
    select 1 from chat_channel_members m
    where m.channel_id = chat_messages.channel_id and m.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_insert" on chat_messages;
create policy "chat_messages_insert" on chat_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from chat_channel_members m
    where m.channel_id = chat_messages.channel_id and m.user_id = auth.uid()
  )
  and not has_role('client') -- clients cannot chat
);

drop policy if exists "chat_messages_update" on chat_messages;
create policy "chat_messages_update" on chat_messages for update using (
  sender_id = auth.uid() -- can only edit own messages
);

-- ---------------------------------------------------------------------------
-- 13.14 CMS (admin/owner only for writes, public read)
-- ---------------------------------------------------------------------------
drop policy if exists "cms_sections_select" on cms_sections;
create policy "cms_sections_select" on cms_sections for select using (true);

drop policy if exists "cms_sections_manage" on cms_sections;
create policy "cms_sections_manage" on cms_sections for all using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "cms_media_select" on cms_media;
create policy "cms_media_select" on cms_media for select using (true);

drop policy if exists "cms_media_manage" on cms_media;
create policy "cms_media_manage" on cms_media for all using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "cms_partners_select" on cms_partners;
create policy "cms_partners_select" on cms_partners for select using (true);

drop policy if exists "cms_partners_manage" on cms_partners;
create policy "cms_partners_manage" on cms_partners for all using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "cms_solutions_select" on cms_solutions;
create policy "cms_solutions_select" on cms_solutions for select using (true);

drop policy if exists "cms_solutions_manage" on cms_solutions;
create policy "cms_solutions_manage" on cms_solutions for all using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "employee_of_month_select" on employee_of_month;
create policy "employee_of_month_select" on employee_of_month for select using (true);

drop policy if exists "employee_of_month_manage" on employee_of_month;
create policy "employee_of_month_manage" on employee_of_month for all using (
  has_any_role(array['admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.15 ACTIVITY LOGS (read by admin/owner, auto-insert via triggers)
-- ---------------------------------------------------------------------------
drop policy if exists "activity_logs_select" on activity_logs;
create policy "activity_logs_select" on activity_logs for select using (
  user_id = auth.uid()
  or has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "activity_logs_insert" on activity_logs;
create policy "activity_logs_insert" on activity_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- 13.16 SYSTEM LOGS (admin/owner only)
-- ---------------------------------------------------------------------------
drop policy if exists "system_logs_select" on system_logs;
create policy "system_logs_select" on system_logs for select using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "system_logs_insert" on system_logs;
create policy "system_logs_insert" on system_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- 13.17 BACKUP LOGS
-- ---------------------------------------------------------------------------
drop policy if exists "backup_logs_select" on backup_logs;
create policy "backup_logs_select" on backup_logs for select using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "backup_logs_insert" on backup_logs;
create policy "backup_logs_insert" on backup_logs for insert with check (
  has_any_role(array['admin','owner']::user_role[])
);

-- ---------------------------------------------------------------------------
-- 13.18 AUTOMATION
-- ---------------------------------------------------------------------------
drop policy if exists "automation_events_select" on automation_events;
create policy "automation_events_select" on automation_events for select using (
  has_any_role(array['admin','owner']::user_role[])
);
drop policy if exists "automation_events_insert" on automation_events;
create policy "automation_events_insert" on automation_events for insert with check (true);

drop policy if exists "automation_webhooks_select" on automation_webhooks;
create policy "automation_webhooks_select" on automation_webhooks for select using (
  has_any_role(array['admin','owner']::user_role[])
);
drop policy if exists "automation_webhooks_manage" on automation_webhooks;
create policy "automation_webhooks_manage" on automation_webhooks for all using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "automation_logs_select" on automation_logs;
create policy "automation_logs_select" on automation_logs for select using (
  has_any_role(array['admin','owner']::user_role[])
);
drop policy if exists "automation_logs_insert" on automation_logs;
create policy "automation_logs_insert" on automation_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- 13.19 EMAIL TEMPLATES
-- ---------------------------------------------------------------------------
drop policy if exists "email_templates_select" on email_templates;
create policy "email_templates_select" on email_templates for select using (
  has_any_role(array['admin','owner']::user_role[])
);

drop policy if exists "email_templates_manage" on email_templates;
create policy "email_templates_manage" on email_templates for all using (
  has_any_role(array['admin','owner']::user_role[])
);

-- ============================================================================
-- 14. STORAGE BUCKET POLICIES
-- ============================================================================

-- Create storage buckets
insert into storage.buckets (id, name, public) values
  ('products', 'products', true),
  ('delivery-proofs', 'delivery-proofs', false),
  ('documents', 'documents', false),
  ('chat-files', 'chat-files', false),
  ('cms-media', 'cms-media', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Products bucket: public read, staff write
drop policy if exists "products_public_read" on storage.objects;
create policy "products_public_read" on storage.objects
  for select using (bucket_id = 'products');

drop policy if exists "products_staff_write" on storage.objects;
create policy "products_staff_write" on storage.objects
  for insert with check (
    bucket_id = 'products'
    and auth.uid() is not null
    and has_any_role(array['warehouse','marketing','admin','owner']::user_role[])
  );

drop policy if exists "products_staff_update" on storage.objects;
create policy "products_staff_update" on storage.objects
  for update using (
    bucket_id = 'products'
    and has_any_role(array['warehouse','marketing','admin','owner']::user_role[])
  );

drop policy if exists "products_staff_delete" on storage.objects;
create policy "products_staff_delete" on storage.objects
  for delete using (
    bucket_id = 'products'
    and has_any_role(array['admin','owner']::user_role[])
  );

-- Delivery proofs: technician write, staff read
drop policy if exists "delivery_proofs_read" on storage.objects;
create policy "delivery_proofs_read" on storage.objects
  for select using (
    bucket_id = 'delivery-proofs'
    and has_any_role(array['technician','warehouse','admin','owner']::user_role[])
  );

drop policy if exists "delivery_proofs_write" on storage.objects;
create policy "delivery_proofs_write" on storage.objects
  for insert with check (
    bucket_id = 'delivery-proofs'
    and has_role('technician')
  );

-- Documents bucket: finance/admin access
drop policy if exists "documents_read" on storage.objects;
create policy "documents_read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and has_any_role(array['finance','admin','owner','tax']::user_role[])
  );

drop policy if exists "documents_write" on storage.objects;
create policy "documents_write" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and has_any_role(array['finance','admin','owner']::user_role[])
  );

-- Chat files: members only
drop policy if exists "chat_files_read" on storage.objects;
create policy "chat_files_read" on storage.objects
  for select using (
    bucket_id = 'chat-files'
    and auth.uid() is not null
    and not has_role('client')
  );

drop policy if exists "chat_files_write" on storage.objects;
create policy "chat_files_write" on storage.objects
  for insert with check (
    bucket_id = 'chat-files'
    and auth.uid() is not null
    and not has_role('client')
  );

-- CMS media: public read, admin write
drop policy if exists "cms_media_public_read" on storage.objects;
create policy "cms_media_public_read" on storage.objects
  for select using (bucket_id = 'cms-media');

drop policy if exists "cms_media_admin_write" on storage.objects;
create policy "cms_media_admin_write" on storage.objects
  for insert with check (
    bucket_id = 'cms-media'
    and has_any_role(array['admin','owner']::user_role[])
  );

drop policy if exists "cms_media_admin_update" on storage.objects;
create policy "cms_media_admin_update" on storage.objects
  for update using (
    bucket_id = 'cms-media'
    and has_any_role(array['admin','owner']::user_role[])
  );

drop policy if exists "cms_media_admin_delete" on storage.objects;
create policy "cms_media_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'cms-media'
    and has_any_role(array['admin','owner']::user_role[])
  );

-- Avatars: owner read/write own
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_own_write" on storage.objects;
create policy "avatars_own_write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
  );

-- ============================================================================
-- 15. REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime on key tables for live updates
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table issues;
alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table products;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
