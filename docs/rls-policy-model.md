# RLS Policy Model

This document explains the Supabase RLS migration in [supabase_rls_phase5.sql](../supabase_rls_phase5.sql).

## Design Principles

- `auth.uid()` is the ownership anchor.
- `profiles.id` must match the authenticated user id.
- Request workflow access is split by role and stage.
- Owner is read-only at the data layer unless a table explicitly allows otherwise.
- RLS controls row visibility.
- Triggers protect workflow transitions and sensitive product updates where RLS alone is not expressive enough.

## Table-by-Table Access Model

### profiles

- Client and internal users can read only their own profile.
- Admin and owner can read all profiles.
- Only admin can update profiles.
- Any authenticated user can insert only their own profile row.

Schema assumption:
- `profiles.id = auth.uid()`

### products

- Public catalog reads remain open to `anon` and `authenticated`.
- Warehouse can update stock fields.
- Admin can create, update, and delete products.
- A trigger prevents warehouse from editing non-stock product fields.

### price_list

- Authenticated users can read.
- Marketing and admin can insert, update, and delete.
- Owner is read-only through general select access.

### requests

- Client reads only own requests and inserts only own `pending` requests.
- Marketing reads `pending` and can transition to `priced`.
- Boss reads `priced` and can transition to `approved` or `rejected`.
- Finance reads `approved` and `invoice_ready`, and can transition to `invoice_ready`.
- Warehouse reads `invoice_ready`, `preparing`, and `ready`, and can move the request through warehouse stages.
- Technician reads `ready` jobs plus assigned jobs, and can move them through delivery stages.
- Admin reads `issue` and `resolved`, and can resolve issue-stage requests.
- Owner reads everything.

Important:
- RLS defines which rows can be touched.
- `enforce_request_workflow()` validates exact old-status to new-status transitions and required fields.

### invoices

- Finance can insert and update.
- Finance, tax, and owner can read all.
- Clients can read only invoices tied to their own requests.

### inventory_logs

- Warehouse and admin can insert.
- Warehouse, admin, and owner can read.
- No update or delete policy is provided.

### delivery_logs

- Technician can insert only for assigned jobs.
- Technician reads only own logs.
- Admin and owner can read all.

### issues

- Client can insert only for own delivered requests and read own issues.
- Admin can update issues.
- Owner can read all issues through admin-level visibility helper.

### notifications

- Users read and update only their own notifications.
- Insert remains authenticated-compatible so the current browser workflow helper can still fan out notifications.

Transitional note:
- For stricter production hardening, notification creation should move to server-side workflow execution.

### activity_logs

- Any authenticated user can insert logs only for themselves.
- Admin and owner can read all.
- Finance can read workflow and invoice-related logs.

### monthly_closing

- Finance inserts and updates.
- Finance, tax, and owner can read.

### payment_promises

- Clients insert and read their own promises.
- Finance and owner can read all promises.

## Required Schema Adjustments

The migration includes the minimum schema alignment needed for safe RLS:

- create `payment_promises` if missing
- add performance indexes for request ownership and stage queries
- add helper functions:
  - `current_app_role()`
  - `has_any_role(...)`
  - `is_request_owner(...)`
  - `can_read_invoice(...)`
  - `can_read_issue(...)`
- add triggers:
  - `requests_workflow_guard`
  - `products_update_guard`

## Workflow Compatibility

The current app still performs workflow updates from the browser. To keep the system working while RLS is strict:

- request transitions are allowed only on the rows and stages owned by that role
- the request trigger blocks invalid status jumps even if a user reaches the table directly
- notification inserts are left broad enough to preserve existing workflow fanout

The next hardening step after this migration should be moving workflow mutations, notifications, and stock changes behind a trusted server-side path.
