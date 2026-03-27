# Inventory Architecture

## Core Model

Inventory is treated as a movement ledger plus a cached balance:

- `inventory_logs` is the source of truth for stock movement
- `products.stock` is the current cached balance used for fast reads

Every stock mutation must create an `inventory_logs` row. The log structure is:

- `product_id`
- `order_id` when the movement is tied to a request
- `change`
- `reason`
- `by_user`
- `created_at`

## Allowed Stock Mutations

### Automatic outbound movement

Stock decreases only when a request transitions:

- `invoice_ready -> preparing`

That transition is handled by the workflow engine, which delegates inventory mutation to [inventory-service.ts](../src/lib/inventory-service.ts).

### Manual inbound or correction movement

Stock increases only through explicit warehouse or admin actions:

- `manual_adjustment`
- `returned_goods`
- `correction`

Those mutations also go through the inventory service.

## Stock Mutation Flow

### Request preparation

1. Warehouse moves a request to `preparing` through the workflow engine.
2. The workflow engine updates the request status first.
3. The workflow engine calls `inventoryService.consumeStockForPreparing(...)`.
4. The inventory service checks whether preparation logs already exist for that order.
5. The inventory service loads the related products and validates available stock.
6. The service calls the `decrement_stock(...)` database function for each item.
7. The service inserts one `inventory_logs` row per deducted item.

This gives us:

- idempotency by order-level preparation log detection
- non-negative stock enforcement
- auditability by item and order

### Manual stock adjustment

1. Warehouse or admin submits a new target stock level.
2. The inventory service calculates the delta.
3. The service updates `products.stock` and `products.status`.
4. The service writes one `inventory_logs` row with a positive or negative `change`.

## Warehouse Workflow Integration

The warehouse dashboard now uses:

- `inventoryService.fetchWarehouseDashboardData()` for requests, products, and recent inventory history
- `inventoryService.adjustStock(...)` for manual stock changes
- the workflow engine for `invoice_ready -> preparing -> ready`

The page no longer owns stock mutation logic directly.

## Idempotency Rules

Preparation cannot deduct stock twice:

- `inventoryService.consumeStockForPreparing(...)` checks for existing `inventory_logs` rows with:
  - matching `order_id`
  - `reason = 'request_preparing'`

If logs already exist, the service rejects the operation.

## RLS and Warehouse Ownership

The current RLS design already limits:

- `products` updates to `warehouse` and `admin`
- `inventory_logs` inserts to `warehouse` and `admin`
- `inventory_logs` reads to `warehouse`, `admin`, and `owner`

That matches the warehouse service boundary.

## Analytics Possibilities

The inventory service includes derived analytics queries for:

- stock movement per month
- most used products
- stock value

### Stock movement per month

Calculated from `inventory_logs` by grouping `created_at` into `YYYY-MM` buckets and splitting:

- inbound
- outbound
- net movement

### Most used products

Calculated from negative `inventory_logs.change` values. This reflects which products are actually consumed by warehouse operations.

### Stock value

Calculated as:

- `products.stock * price_list.price_regular`

This is a practical operational proxy. If cost accounting is added later, stock valuation should move to a proper cost basis.

## Database Alignment

Phase 6 adds [supabase_inventory_phase6.sql](../supabase_inventory_phase6.sql), which:

- adds `inventory_logs.order_id`
- adds indexes for order and product movement history
- replaces `decrement_stock(...)` with a strict version that rejects insufficient stock

## Current Limitation

The system still updates request status first and inventory second. The code does attempt rollback on preparation-side failure, but this is not a true database transaction across all affected tables. The long-term production-hardening step is to move preparation into one trusted backend mutation or RPC that performs:

- request transition
- stock deduction
- inventory log insert
- activity log insert
- notification fanout

as one authoritative server-side workflow action.
