-- ============================================================
-- PHASE 10 - AUTOMATION EVENTS
-- ============================================================

begin;

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists automation_events_status_created_idx
on public.automation_events(status, created_at desc);

create index if not exists automation_events_type_created_idx
on public.automation_events(event_type, created_at desc);

alter table public.automation_events enable row level security;
alter table public.automation_events force row level security;

drop policy if exists "automation_events_insert_authenticated" on public.automation_events;
drop policy if exists "automation_events_select_admin_owner" on public.automation_events;
drop policy if exists "automation_events_update_admin_owner" on public.automation_events;

create policy "automation_events_insert_authenticated"
on public.automation_events
for insert
to authenticated
with check (true);

create policy "automation_events_select_admin_owner"
on public.automation_events
for select
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
);

create policy "automation_events_update_admin_owner"
on public.automation_events
for update
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
)
with check (
  public.has_any_role(array['admin', 'owner'])
);

commit;
