-- ============================================================
-- PHASE 6 - INVENTORY AND WAREHOUSE ALIGNMENT
-- ============================================================

begin;

alter table public.inventory_logs
  add column if not exists order_id uuid references public.requests(id) on delete set null;

create index if not exists inventory_logs_order_id_idx on public.inventory_logs(order_id);
create index if not exists inventory_logs_product_created_idx on public.inventory_logs(product_id, created_at desc);

create or replace function public.decrement_stock(p_product_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
  next_stock integer;
begin
  if p_qty <= 0 then
    raise exception 'stock decrement quantity must be positive';
  end if;

  select stock
  into current_stock
  from public.products
  where id = p_product_id
  for update;

  if current_stock is null then
    raise exception 'product % not found', p_product_id;
  end if;

  if current_stock < p_qty then
    raise exception 'insufficient stock for product % (have %, need %)', p_product_id, current_stock, p_qty;
  end if;

  next_stock := current_stock - p_qty;

  update public.products
  set
    stock = next_stock,
    status = case when next_stock = 0 then 'out_of_stock' else 'in_stock' end
  where id = p_product_id;
end;
$$;

commit;

-- ============================================================
-- NOTES
-- 1. inventory_logs.order_id links stock movement back to a request.
-- 2. products.stock remains the cached current balance.
-- 3. inventory_logs remains the movement ledger.
-- ============================================================
