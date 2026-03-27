# Security Architecture

## Purpose

This document defines the centralized permission model for the internal company operating system. It is the Phase 4 security baseline and is intended to align:

- dashboard routing
- workflow mutations
- service boundaries
- future Supabase RLS policies
- trusted and untrusted execution paths

The application permission source of truth is [permissions.ts](../src/lib/permissions.ts). Workflow mutation enforcement is handled by [workflow-engine.ts](../src/lib/workflow-engine.ts).

## Permission Model

Each role is defined by:

- allowed routes
- readable entity scopes
- writable entity scopes
- allowed workflow transitions

### Client

- Pages: `/dashboard`, `/dashboard/client`, `/dashboard/client/issues`, `/dashboard/notifications`, `/request`
- Requests readable: own requests only
- Requests writable: own requests only
- Workflow transitions: `delivered -> completed`, `delivered -> issue`
- Tables readable: own profile, catalog products, catalog price list, own requests, own issues, own notifications, own payment promises
- Tables writable: own requests, own issues, own payment promises, own notifications state

### Marketing

- Pages: `/dashboard`, `/dashboard/marketing`, `/dashboard/marketing/prices`, `/dashboard/notifications`
- Requests readable: pending requests
- Requests writable: pending requests during pricing
- Workflow transitions: `pending -> priced`
- Tables readable: own profile, product catalog, full products, full price list, pending requests, own notifications
- Tables writable: price list, pending request pricing fields, own notifications state

### Boss

- Pages: `/dashboard`, `/dashboard/boss`, `/dashboard/notifications`
- Requests readable: priced requests
- Requests writable: priced requests for approval decisions
- Workflow transitions: `priced -> approved`, `priced -> rejected`
- Tables readable: own profile, priced requests, own notifications
- Tables writable: priced requests, own notifications state

### Finance

- Pages: `/dashboard`, `/dashboard/finance`, `/dashboard/notifications`
- Requests readable: approved requests
- Requests writable: approved requests for invoicing stage
- Workflow transitions: `approved -> invoice_ready`
- Tables readable: own profile, approved requests, invoices, monthly closing, own notifications, request activity logs
- Tables writable: approved requests, invoices, monthly closing, own notifications state

### Warehouse

- Pages: `/dashboard`, `/dashboard/warehouse`, `/dashboard/notifications`
- Requests readable: warehouse-stage requests
- Requests writable: warehouse-stage requests
- Workflow transitions: `invoice_ready -> preparing`, `preparing -> ready`
- Tables readable: own profile, warehouse-stage requests, all products, warehouse inventory logs, own notifications
- Tables writable: warehouse-stage requests, products stock state, warehouse inventory logs, own notifications state

### Technician

- Pages: `/dashboard`, `/dashboard/technician`, `/dashboard/notifications`
- Requests readable: technician-stage requests
- Requests writable: technician-stage requests
- Workflow transitions: `ready -> on_delivery`, `on_delivery -> delivered`
- Tables readable: own profile, technician-stage requests, technician delivery logs, own notifications
- Tables writable: technician-stage requests, technician delivery logs, own notifications state

### Admin

- Pages: `/dashboard`, `/dashboard/admin`, `/dashboard/notifications`
- Requests readable: issue-stage requests
- Requests writable: issue-stage requests
- Workflow transitions: `issue -> resolved`
- Tables readable: all profiles, all products, issue-stage requests, issues, all inventory logs, all delivery logs, own notifications, all activity logs
- Tables writable: profiles, products, issue-stage requests, issues, inventory logs, own notifications state

### Owner

- Pages: `/dashboard`, `/dashboard/owner`, `/dashboard/notifications`
- Requests readable: all requests
- Requests writable: none for workflow
- Workflow transitions: none
- Tables readable: all major operational and reporting tables
- Tables writable: own notifications state only

### Tax

- Pages: `/dashboard`, `/dashboard/tax`, `/dashboard/notifications`
- Requests readable: none directly unless needed through reports
- Requests writable: none
- Workflow transitions: none
- Tables readable: own profile, invoices reporting view, monthly closing reporting data, own notifications
- Tables writable: own notifications state only

## Workflow Security

All request status changes must go through `workflowEngine.transitionOrder(...)`.

The engine validates:

- allowed previous status to next status
- actor role permission through `canTransition(...)`
- required fields for the target transition
- invoice existence before `invoice_ready`
- assigned technician before `on_delivery`
- stock deduction only on `preparing`

The engine also creates:

- request status timestamps
- activity log entries
- notifications

Direct client-side `requests.status` updates are no longer the intended architecture and should be considered a policy violation.

## Trusted vs Untrusted Operations

### Untrusted browser-safe operations

These can remain browser initiated if RLS is strict:

- low-risk reads scoped by RLS
- notification read state updates
- client-side filtering and presentation
- local draft form state

### Trusted operations that should move off the browser

These should be migrated to server actions, edge functions, or RPC because they change company-critical state:

- workflow transitions
- invoice generation
- stock deduction and preparation processing
- issue resolution
- profile role changes
- manual stock adjustments
- delivery proof upload signing and validation
- monthly closing

## Recommended Mutation Boundary

### Server actions

Use for authenticated dashboard mutations initiated from Next.js UI where request context is required:

- profile updates allowed to admin
- notification mark-as-read
- filtered report exports

### Edge functions

Use for privileged multi-step operations with cross-table side effects:

- invoice creation plus request transition
- issue resolution plus request transition
- monthly closing snapshots
- role-protected analytics exports

### RPC / Postgres functions

Use for atomic database-side logic:

- stock decrement during `preparing`
- idempotent preparation checks
- technician assignment claim
- transition audit insert bundles

The long-term goal is to move `workflowEngine.transitionOrder(...)` behind a trusted endpoint that calls one secured backend mutation instead of multiple direct browser writes.

## RLS Model

The current SQL policies are broader than required. The strict target model should be:

### profiles

- user can read and update own profile
- admin can read and update all profiles
- owner can read all profiles
- no one else can update other users

### products

- authenticated users can read product catalog fields
- marketing, warehouse, admin, owner can read full product rows
- warehouse and admin can update stock-related fields
- admin can create or delete products

### price_list

- authenticated users can read active prices needed for quoting
- marketing can insert and update
- admin and owner can read all
- delete restricted to marketing and admin

### requests

- client can read and create own requests
- client can update only own requests when transition target is `completed` or `issue`
- marketing can read `pending` and update only pricing-stage requests
- boss can read `priced` and update only approval-stage requests
- finance can read `approved` and update only finance-stage requests
- warehouse can read `invoice_ready`, `preparing`, `ready`
- technician can read `ready` claimable orders and assigned delivery orders
- admin can read `issue` and `resolved` operational records
- owner can read all

### invoices

- finance can read and write all invoices
- tax can read all invoices
- owner can read all invoices
- clients should not read all invoice rows unless a future client invoice view is explicitly designed

### inventory_logs

- warehouse can insert and read warehouse logs
- admin and owner can read all
- direct updates should be disallowed; append-only preferred

### delivery_logs

- technician can insert for own assigned deliveries
- technician can read own delivery logs
- admin and owner can read all

### issues

- client can create and read own issues
- admin can read and resolve all issues
- owner can read all issues

### notifications

- users can read and update only their own notifications
- inserts should come from trusted backend workflow paths

### activity_logs

- inserts should come from trusted backend workflow paths only
- owner and admin can read all
- finance can read request-related finance events where needed

### monthly_closing

- finance can insert and update
- owner and tax can read

### payment_promises

- client can create and read own promises
- finance and owner can read for debt control

## Service-Level Permission Rules

The frontend should not decide business authority by itself. Service rules should be:

- route check controls dashboard access
- service permission check controls whether a page can call a domain service
- workflow engine controls legal status transitions
- RLS controls actual database visibility

No single layer is enough by itself.

## Immediate Follow-Up

The next hardening step is to align the Supabase SQL policies with this matrix, then move high-trust workflow mutations behind secured server-side execution.
