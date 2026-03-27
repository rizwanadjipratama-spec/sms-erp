create extension if not exists pgcrypto;

create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('info', 'warning', 'error')),
  service text not null,
  action text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_logs_created_at on public.system_logs (created_at desc);
create index if not exists idx_system_logs_service_created_at on public.system_logs (service, created_at desc);
create index if not exists idx_system_logs_level_created_at on public.system_logs (level, created_at desc);

alter table public.system_logs enable row level security;
alter table public.system_logs force row level security;

drop policy if exists system_logs_select_admin_owner on public.system_logs;
create policy system_logs_select_admin_owner
on public.system_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
  )
);

drop policy if exists system_logs_insert_authenticated on public.system_logs;
create policy system_logs_insert_authenticated
on public.system_logs
for insert
to authenticated
with check (true);
