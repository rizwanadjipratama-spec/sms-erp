create extension if not exists pgcrypto;

create table if not exists public.backup_logs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null check (backup_type in ('database', 'storage', 'full')),
  file_url text,
  status text not null check (status in ('pending', 'completed', 'failed', 'verified', 'restored', 'partial')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  size bigint,
  notes text
);

create index if not exists idx_backup_logs_created_at on public.backup_logs (created_at desc);
create index if not exists idx_backup_logs_status_created_at on public.backup_logs (status, created_at desc);

alter table public.backup_logs enable row level security;
alter table public.backup_logs force row level security;

drop policy if exists backup_logs_select_admin_owner on public.backup_logs;
create policy backup_logs_select_admin_owner
on public.backup_logs
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

drop policy if exists backup_logs_insert_admin_owner on public.backup_logs;
create policy backup_logs_insert_admin_owner
on public.backup_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
  )
);

drop policy if exists backup_logs_update_admin_owner on public.backup_logs;
create policy backup_logs_update_admin_owner
on public.backup_logs
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
  )
);
