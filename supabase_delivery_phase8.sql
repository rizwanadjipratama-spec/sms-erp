-- ============================================================
-- PHASE 8 - DELIVERY AND TECHNICIAN ALIGNMENT
-- ============================================================

begin;

alter table public.requests
  add column if not exists on_delivery_at timestamptz,
  add column if not exists delivered_at timestamptz;

create unique index if not exists delivery_logs_order_id_unique_idx
on public.delivery_logs(order_id);

create index if not exists delivery_logs_technician_delivered_idx
on public.delivery_logs(technician_id, delivered_at desc);

create index if not exists requests_delivery_assignment_idx
on public.requests(assigned_technician_id, status);

commit;

-- ============================================================
-- NOTES
-- 1. one request maps to one delivery completion log
-- 2. delivery timing analytics use requests.on_delivery_at and
--    requests.delivered_at
-- ============================================================
