-- ============================================================
-- PHASE 11 - WEBHOOK AUTOMATION
-- ============================================================

begin;

alter table public.automation_events
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text;

create table if not exists public.automation_webhooks (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  webhook_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.automation_events(id) on delete cascade,
  webhook_url text not null,
  status text not null check (status in ('success', 'failed')),
  response text,
  created_at timestamptz not null default now()
);

create index if not exists automation_webhooks_event_active_idx
on public.automation_webhooks(event_type, active);

create index if not exists automation_logs_event_created_idx
on public.automation_logs(event_id, created_at desc);

alter table public.automation_webhooks enable row level security;
alter table public.automation_webhooks force row level security;
alter table public.automation_logs enable row level security;
alter table public.automation_logs force row level security;

drop policy if exists "automation_webhooks_admin_owner_select" on public.automation_webhooks;
drop policy if exists "automation_webhooks_admin_owner_insert" on public.automation_webhooks;
drop policy if exists "automation_webhooks_admin_owner_update" on public.automation_webhooks;
drop policy if exists "automation_logs_admin_owner_select" on public.automation_logs;
drop policy if exists "automation_logs_admin_owner_insert" on public.automation_logs;

create policy "automation_webhooks_admin_owner_select"
on public.automation_webhooks
for select
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
);

create policy "automation_webhooks_admin_owner_insert"
on public.automation_webhooks
for insert
to authenticated
with check (
  public.has_any_role(array['admin', 'owner'])
);

create policy "automation_webhooks_admin_owner_update"
on public.automation_webhooks
for update
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
)
with check (
  public.has_any_role(array['admin', 'owner'])
);

create policy "automation_logs_admin_owner_select"
on public.automation_logs
for select
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
);

create policy "automation_logs_admin_owner_insert"
on public.automation_logs
for insert
to authenticated
with check (
  public.has_any_role(array['admin', 'owner'])
);

commit;
