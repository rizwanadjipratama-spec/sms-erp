-- ============================================================
-- PHASE 14 - PERFORMANCE INDEXES
-- ============================================================

begin;

create index if not exists requests_status_idx on public.requests(status);
create index if not exists requests_user_id_idx on public.requests(user_id);
create index if not exists requests_created_at_idx on public.requests(created_at desc);
create index if not exists invoices_order_id_idx on public.invoices(order_id);
create index if not exists invoices_paid_idx on public.invoices(paid);
create index if not exists inventory_logs_product_id_idx on public.inventory_logs(product_id);
create index if not exists delivery_logs_order_id_idx on public.delivery_logs(order_id);
create index if not exists issues_order_id_idx on public.issues(order_id);
create index if not exists notifications_user_id_read_idx on public.notifications(user_id, read);
create index if not exists activity_logs_entity_lookup_idx on public.activity_logs(entity_type, entity_id);
create index if not exists automation_events_status_idx on public.automation_events(status);
create index if not exists automation_logs_event_id_idx on public.automation_logs(event_id);

commit;
