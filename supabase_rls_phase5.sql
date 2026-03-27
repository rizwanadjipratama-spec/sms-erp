-- ============================================================
-- PHASE 5 - DATABASE USAGE AND RLS ALIGNMENT
-- Strict row level security aligned with src/lib/permissions.ts
-- ============================================================

begin;

-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'user'
  );
$$;

create or replace function public.has_any_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = any(roles);
$$;

create or replace function public.is_request_owner(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = request_id
      and r.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_invoice(invoice_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_any_role(array['finance', 'tax', 'owner']) or
    exists (
      select 1
      from public.requests r
      where r.id = invoice_order_id
        and r.user_id = auth.uid()
    );
$$;

create or replace function public.can_read_issue(issue_order_id uuid, issue_reported_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    issue_reported_by = auth.uid() or
    public.has_any_role(array['admin', 'owner']);
$$;

create or replace function public.enforce_request_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := public.current_app_role();
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'request owner cannot be changed';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if actor_role in ('owner', 'tax', 'user') then
    raise exception 'role % cannot change request workflow', actor_role;
  end if;

  if actor_role = 'client' then
    if old.user_id <> auth.uid() then
      raise exception 'client can only update own requests';
    end if;

    if not (
      (old.status = 'delivered' and new.status = 'completed') or
      (old.status = 'delivered' and new.status = 'issue')
    ) then
      raise exception 'invalid client transition: % -> %', old.status, new.status;
    end if;
  elsif actor_role = 'marketing' then
    if not (old.status = 'pending' and new.status = 'priced') then
      raise exception 'invalid marketing transition: % -> %', old.status, new.status;
    end if;

    if coalesce(new.price_total, 0) <= 0 then
      raise exception 'price_total is required for priced status';
    end if;

    if nullif(btrim(coalesce(new.marketing_note, '')), '') is null then
      raise exception 'marketing_note is required for priced status';
    end if;
  elsif actor_role = 'boss' then
    if not (
      (old.status = 'priced' and new.status = 'approved') or
      (old.status = 'priced' and new.status = 'rejected')
    ) then
      raise exception 'invalid boss transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'rejected' and nullif(btrim(coalesce(new.rejection_reason, '')), '') is null then
      raise exception 'rejection_reason is required when rejecting';
    end if;
  elsif actor_role = 'finance' then
    if not (old.status = 'approved' and new.status = 'invoice_ready') then
      raise exception 'invalid finance transition: % -> %', old.status, new.status;
    end if;

    if not exists (
      select 1 from public.invoices i where i.order_id = old.id
    ) then
      raise exception 'invoice must exist before invoice_ready';
    end if;
  elsif actor_role = 'warehouse' then
    if not (
      (old.status = 'invoice_ready' and new.status = 'preparing') or
      (old.status = 'preparing' and new.status = 'ready')
    ) then
      raise exception 'invalid warehouse transition: % -> %', old.status, new.status;
    end if;
  elsif actor_role = 'technician' then
    if not (
      (old.status = 'ready' and new.status = 'on_delivery') or
      (old.status = 'on_delivery' and new.status = 'delivered')
    ) then
      raise exception 'invalid technician transition: % -> %', old.status, new.status;
    end if;

    if new.assigned_technician_id is null then
      raise exception 'assigned_technician_id is required for technician workflow';
    end if;

    if new.assigned_technician_id <> auth.uid() then
      raise exception 'technician can only assign or complete own deliveries';
    end if;

    if old.status = 'on_delivery' and old.assigned_technician_id <> auth.uid() then
      raise exception 'technician can only complete assigned delivery';
    end if;
  elsif actor_role = 'admin' then
    if not (old.status = 'issue' and new.status = 'resolved') then
      raise exception 'invalid admin transition: % -> %', old.status, new.status;
    end if;
  else
    raise exception 'unsupported role %', actor_role;
  end if;

  return new;
end;
$$;

create or replace function public.protect_product_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := public.current_app_role();
begin
  if actor_role = 'warehouse' then
    if new.id is distinct from old.id
      or new.name is distinct from old.name
      or new.image is distinct from old.image
      or new.category is distinct from old.category then
      raise exception 'warehouse can only update stock fields';
    end if;
  elsif actor_role <> 'admin' then
    raise exception 'only admin or warehouse can update products';
  end if;

  return new;
end;
$$;

-- ============================================================
-- 2. REQUIRED SCHEMA ALIGNMENT
-- ============================================================

create table if not exists public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text,
  promise_date date not null,
  note text,
  request_id uuid references public.requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists requests_user_id_idx on public.requests(user_id);
create index if not exists requests_status_idx on public.requests(status);
create index if not exists requests_assigned_technician_idx on public.requests(assigned_technician_id);
create index if not exists invoices_order_id_idx on public.invoices(order_id);
create index if not exists issues_reported_by_idx on public.issues(reported_by);
create index if not exists delivery_logs_order_id_idx on public.delivery_logs(order_id);
create index if not exists payment_promises_user_id_idx on public.payment_promises(user_id); --ini gabisa dibuat karena sudah ada data, harusnya sih gak masalah karena cuma index biasa, tapi kalau error bisa dicoba buat index partial untuk yang user_id is not null

-- ============================================================
-- 3. ENABLE AND FORCE RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.price_list enable row level security;
alter table public.requests enable row level security;
alter table public.invoices enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.delivery_logs enable row level security;
alter table public.issues enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.monthly_closing enable row level security;
alter table public.payment_promises enable row level security;

alter table public.profiles force row level security;
alter table public.products force row level security;
alter table public.price_list force row level security;
alter table public.requests force row level security;
alter table public.invoices force row level security;
alter table public.inventory_logs force row level security;
alter table public.delivery_logs force row level security;
alter table public.issues force row level security;
alter table public.notifications force row level security;
alter table public.activity_logs force row level security;
alter table public.monthly_closing force row level security;
alter table public.payment_promises force row level security;

-- ============================================================
-- 4. DROP LEGACY PERMISSIVE POLICIES
-- ============================================================

drop policy if exists "price_list_read" on public.price_list;
drop policy if exists "price_list_write" on public.price_list;
drop policy if exists "notifications_own" on public.notifications;
drop policy if exists "invoices_all" on public.invoices;
drop policy if exists "delivery_logs_all" on public.delivery_logs;
drop policy if exists "inventory_logs_all" on public.inventory_logs;
drop policy if exists "activity_logs_insert" on public.activity_logs;
drop policy if exists "activity_logs_read" on public.activity_logs;
drop policy if exists "issues_all" on public.issues;
drop policy if exists "monthly_closing_all" on public.monthly_closing;

-- ============================================================
-- 5. PROFILES POLICIES
-- ============================================================

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.has_any_role(array['admin', 'owner'])
);

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
);

create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (
  public.has_any_role(array['admin'])
)
with check (
  public.has_any_role(array['admin'])
);

-- ============================================================
-- 6. PRODUCTS POLICIES
-- ============================================================

drop policy if exists "products_select_catalog" on public.products;
drop policy if exists "products_insert_admin" on public.products;
drop policy if exists "products_update_admin_or_warehouse" on public.products;
drop policy if exists "products_delete_admin" on public.products;

create policy "products_select_catalog"
on public.products
for select
to anon, authenticated
using (true);

create policy "products_insert_admin"
on public.products
for insert
to authenticated
with check (
  public.has_any_role(array['admin'])
);

create policy "products_update_admin_or_warehouse"
on public.products
for update
to authenticated
using (
  public.has_any_role(array['admin', 'warehouse'])
)
with check (
  public.has_any_role(array['admin', 'warehouse'])
);

create policy "products_delete_admin"
on public.products
for delete
to authenticated
using (
  public.has_any_role(array['admin'])
);

-- ============================================================
-- 7. PRICE LIST POLICIES
-- ============================================================

drop policy if exists "price_list_select_authenticated" on public.price_list;
drop policy if exists "price_list_insert_marketing_admin" on public.price_list;
drop policy if exists "price_list_update_marketing_admin" on public.price_list;
drop policy if exists "price_list_delete_marketing_admin" on public.price_list;

create policy "price_list_select_authenticated"
on public.price_list
for select
to authenticated
using (true);

create policy "price_list_insert_marketing_admin"
on public.price_list
for insert
to authenticated
with check (
  public.has_any_role(array['marketing', 'admin'])
);

create policy "price_list_update_marketing_admin"
on public.price_list
for update
to authenticated
using (
  public.has_any_role(array['marketing', 'admin'])
)
with check (
  public.has_any_role(array['marketing', 'admin'])
);

create policy "price_list_delete_marketing_admin"
on public.price_list
for delete
to authenticated
using (
  public.has_any_role(array['marketing', 'admin'])
);

-- ============================================================
-- 8. REQUESTS POLICIES
-- ============================================================

drop policy if exists "requests_select_client_own" on public.requests;
drop policy if exists "requests_select_marketing_pending" on public.requests;
drop policy if exists "requests_select_boss_priced" on public.requests;
drop policy if exists "requests_select_finance_stage" on public.requests;
drop policy if exists "requests_select_warehouse_stage" on public.requests;
drop policy if exists "requests_select_technician_stage" on public.requests;
drop policy if exists "requests_select_admin_issue" on public.requests;
drop policy if exists "requests_select_owner_all" on public.requests;
drop policy if exists "requests_insert_client_own" on public.requests;
drop policy if exists "requests_update_client_complete_or_issue" on public.requests;
drop policy if exists "requests_update_marketing_price" on public.requests;
drop policy if exists "requests_update_boss_approve_or_reject" on public.requests;
drop policy if exists "requests_update_finance_invoice_ready" on public.requests;
drop policy if exists "requests_update_warehouse_preparing" on public.requests;
drop policy if exists "requests_update_warehouse_ready" on public.requests;
drop policy if exists "requests_update_technician_pickup" on public.requests;
drop policy if exists "requests_update_technician_delivered" on public.requests;
drop policy if exists "requests_update_admin_resolved" on public.requests;

create policy "requests_select_client_own"
on public.requests
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "requests_select_marketing_pending"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['marketing']) and status = 'pending'
);

create policy "requests_select_boss_priced"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['boss']) and status = 'priced'
);

create policy "requests_select_finance_stage"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['finance']) and status in ('approved', 'invoice_ready')
);

create policy "requests_select_warehouse_stage"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['warehouse']) and status in ('invoice_ready', 'preparing', 'ready')
);

create policy "requests_select_technician_stage"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['technician']) and (
    status = 'ready'
    or assigned_technician_id = auth.uid()
  )
);

create policy "requests_select_admin_issue"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['admin']) and status in ('issue', 'resolved')
);

create policy "requests_select_owner_all"
on public.requests
for select
to authenticated
using (
  public.has_any_role(array['owner'])
);

reate policy "requests_insert_client_own"
on public.requests
for insert
to authenticated
with check (
  public.current_app_role() in ('client', 'user')
  and user_id = auth.uid()
  and status = 'pending'
);

create policy "requests_update_client_complete_or_issue"
on public.requests
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'delivered'
)
with check (
  user_id = auth.uid()
  and status in ('completed', 'issue')
);c

create policy "requests_update_marketing_price"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['marketing'])
  and status = 'pending'
)
with check (
  public.has_any_role(array['marketing'])
  and status = 'priced'
);

create policy "requests_update_boss_approve_or_reject"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['boss'])
  and status = 'priced'
)
with check (
  public.has_any_role(array['boss'])
  and status in ('approved', 'rejected')
);

create policy "requests_update_finance_invoice_ready"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['finance'])
  and status = 'approved'
)
with check (
  public.has_any_role(array['finance'])
  and status = 'invoice_ready'
);

create policy "requests_update_warehouse_preparing"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['warehouse'])
  and status = 'invoice_ready'
)
with check (
  public.has_any_role(array['warehouse'])
  and status = 'preparing'
);

create policy "requests_update_warehouse_ready"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['warehouse'])
  and status = 'preparing'
)
with check (
  public.has_any_role(array['warehouse'])
  and status = 'ready'
);

create policy "requests_update_technician_pickup"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['technician'])
  and status = 'ready'
)
with check (
  public.has_any_role(array['technician'])
  and status = 'on_delivery'
  and assigned_technician_id = auth.uid()
);

create policy "requests_update_technician_delivered"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['technician'])
  and status = 'on_delivery'
  and assigned_technician_id = auth.uid()
)
with check (
  public.has_any_role(array['technician'])
  and status = 'delivered'
  and assigned_technician_id = auth.uid()
);

create policy "requests_update_admin_resolved"
on public.requests
for update
to authenticated
using (
  public.has_any_role(array['admin'])
  and status = 'issue'
)
with check (
  public.has_any_role(array['admin'])
  and status = 'resolved'
);

-- ============================================================
-- 9. INVOICES POLICIES
-- ============================================================

drop policy if exists "invoices_select_finance_tax_owner_or_client" on public.invoices;
drop policy if exists "invoices_insert_finance" on public.invoices;
drop policy if exists "invoices_update_finance" on public.invoices;

create policy "invoices_select_finance_tax_owner_or_client"
on public.invoices
for select
to authenticated
using (
  public.can_read_invoice(order_id)
);

create policy "invoices_insert_finance"
on public.invoices
for insert
to authenticated
with check (
  public.has_any_role(array['finance'])
  and exists (
    select 1
    from public.requests r
    where r.id = order_id
      and r.status in ('approved', 'invoice_ready')
  )
);

create policy "invoices_update_finance"
on public.invoices
for update
to authenticated
using (
  public.has_any_role(array['finance'])
)
with check (
  public.has_any_role(array['finance'])
);

-- ============================================================
-- 10. INVENTORY LOGS POLICIES
-- ============================================================

drop policy if exists "inventory_logs_select_ops" on public.inventory_logs;
drop policy if exists "inventory_logs_insert_ops" on public.inventory_logs;

create policy "inventory_logs_select_ops"
on public.inventory_logs
for select
to authenticated
using (
  public.has_any_role(array['warehouse', 'admin', 'owner'])
);

create policy "inventory_logs_insert_ops"
on public.inventory_logs
for insert
to authenticated
with check (
  public.has_any_role(array['warehouse', 'admin'])
);

-- ============================================================
-- 11. DELIVERY LOGS POLICIES
-- ============================================================

drop policy if exists "delivery_logs_select_ops" on public.delivery_logs;
drop policy if exists "delivery_logs_insert_technician" on public.delivery_logs;

create policy "delivery_logs_select_ops"
on public.delivery_logs
for select
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
  or technician_id = auth.uid()
);

create policy "delivery_logs_insert_technician"
on public.delivery_logs
for insert
to authenticated
with check (
  public.has_any_role(array['technician'])
  and technician_id = auth.uid()
  and exists (
    select 1
    from public.requests r
    where r.id = order_id
      and r.assigned_technician_id = auth.uid()
      and r.status in ('on_delivery', 'delivered')
  )
);

-- ============================================================
-- 12. ISSUES POLICIES
-- ============================================================

drop policy if exists "issues_select_own_or_admin" on public.issues;
drop policy if exists "issues_insert_client_own" on public.issues;
drop policy if exists "issues_update_admin" on public.issues;

create policy "issues_select_own_or_admin"
on public.issues
for select
to authenticated
using (
  public.can_read_issue(order_id, reported_by)
);

create policy "issues_insert_client_own"
on public.issues
for insert
to authenticated
with check (
  public.current_app_role() in ('client', 'user')
  and reported_by = auth.uid()
  and exists (
    select 1
    from public.requests r
    where r.id = order_id
      and r.user_id = auth.uid()
      and r.status in ('delivered', 'issue', 'resolved')
  )
);

create policy "issues_update_admin"
on public.issues
for update
to authenticated
using (
  public.has_any_role(array['admin'])
)
with check (
  public.has_any_role(array['admin'])
);

-- ============================================================
-- 13. NOTIFICATIONS POLICIES
-- ============================================================

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_insert_workflow" on public.notifications;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy "notifications_insert_workflow"
on public.notifications
for insert
to authenticated
with check (
  user_id is not null
  and (
    order_id is null
    or exists (
      select 1
      from public.requests r
      where r.id = order_id
    )
  )
);

-- ============================================================
-- 14. ACTIVITY LOGS POLICIES
-- ============================================================

drop policy if exists "activity_logs_insert_actor" on public.activity_logs;
drop policy if exists "activity_logs_select_admin_owner_finance" on public.activity_logs;

create policy "activity_logs_insert_actor"
on public.activity_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy "activity_logs_select_admin_owner_finance"
on public.activity_logs
for select
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
  or (
    public.has_any_role(array['finance'])
    and entity_type in ('request', 'invoice', 'monthly_closing')
  )
);

-- ============================================================
-- 15. MONTHLY CLOSING POLICIES
-- ============================================================

drop policy if exists "monthly_closing_select_finance_tax_owner" on public.monthly_closing;
drop policy if exists "monthly_closing_insert_finance" on public.monthly_closing;
drop policy if exists "monthly_closing_update_finance" on public.monthly_closing;

create policy "monthly_closing_select_finance_tax_owner"
on public.monthly_closing
for select
to authenticated
using (
  public.has_any_role(array['finance', 'tax', 'owner'])
);

create policy "monthly_closing_insert_finance"
on public.monthly_closing
for insert
to authenticated
with check (
  public.has_any_role(array['finance'])
);

create policy "monthly_closing_update_finance"
on public.monthly_closing
for update
to authenticated
using (
  public.has_any_role(array['finance'])
)
with check (
  public.has_any_role(array['finance'])
);

-- ============================================================
-- 16. PAYMENT PROMISES POLICIES
-- ============================================================

drop policy if exists "payment_promises_select_owner_finance_or_self" on public.payment_promises;
drop policy if exists "payment_promises_insert_self" on public.payment_promises;

create policy "payment_promises_select_owner_finance_or_self"
on public.payment_promises
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_any_role(array['finance', 'owner'])
);

create policy "payment_promises_insert_self" --gabisa dibuat karena sudah ada data, harusnya sih gak masalah karena cuma policy insert, tapi kalau error bisa dicoba buat policy insert dengan check user_id = auth.uid() dan buat index partial untuk yang user_id is not null
on public.payment_promises
for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- ============================================================
-- 17. WORKFLOW AND PRODUCT TRIGGERS
-- ============================================================

drop trigger if exists requests_workflow_guard on public.requests;
create trigger requests_workflow_guard
before update on public.requests
for each row
execute function public.enforce_request_workflow();

drop trigger if exists products_update_guard on public.products;
create trigger products_update_guard
before update on public.products
for each row
execute function public.protect_product_updates();

commit;

-- ============================================================
-- NOTES
-- 1. notifications insert remains broad enough for current client-side
--    workflow helpers to keep working. Move notification creation to a
--    trusted backend path later for stricter enforcement.
-- 2. request workflow safety is enforced by BOTH RLS and the
--    enforce_request_workflow() trigger.
-- ============================================================
