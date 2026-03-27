-- ============================================================
-- PHASE 7 - FINANCE AND INVOICE ALIGNMENT
-- ============================================================

begin;

create unique index if not exists invoices_order_id_unique_idx
on public.invoices(order_id);

alter table public.invoices
  drop constraint if exists invoices_invoice_number_format_chk;

alter table public.invoices
  add constraint invoices_invoice_number_format_chk
  check (invoice_number ~ '^INV/[0-9]{4}/[0-9]{2}/[0-9]{4}$');

create index if not exists invoices_created_at_idx
on public.invoices(created_at desc);

create index if not exists invoices_paid_created_at_idx
on public.invoices(paid, created_at desc);

commit; -- Error: Failed to run sql query: ERROR: 23514: check constraint "invoices_invoice_number_format_chk" of relation "invoices" is violated by some row

-- ============================================================
-- NOTES
-- 1. one request now maps to one invoice row
-- 2. invoice numbers must follow INV/YYYY/MM/XXXX
-- ============================================================
