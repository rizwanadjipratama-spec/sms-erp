# Automation Architecture

## Overview

Phase 10 adds an automation preparation layer on top of the ERP:

- `automation_events` stores durable system events
- `emitSystemEvent(...)` now persists events and creates audit side effects
- `automation-service.ts` provides operational automation tasks
- `email-service.ts` provides provider-agnostic email payload builders
- `/dashboard/admin/automation` provides an admin console for event processing

This phase prepares the system for:

- n8n webhook integration
- cron-based event processing
- external email delivery providers
- month-end automation orchestration

## Event Flow

1. A system event is emitted through `emitSystemEvent(...)`.
2. A row is inserted into `automation_events`.
3. A notification is created for the relevant recipients.
4. An activity log is written for auditability.
5. The event remains `pending` until processed by the automation service.

## Automation Tasks

### `processPendingEvents()`

- loads pending events
- prepares email dispatch
- prepares webhook payload dispatch
- marks events as `processed` or `failed`

### `checkLowStock()`

- finds products with `stock < 5`
- emits `low_stock_warning`

### `checkOverdueInvoices()`

- finds unpaid invoices past due date
- emits `invoice_overdue`

### `runMonthlyAutomation()`

- prepares a month-end sales snapshot
- if running in a finance context later, can execute monthly closing directly
- emits `monthly_closing_created`

## Email Service

The email service does not call any external provider yet.

It only returns structured payloads for:

- request created
- approval update
- invoice update
- delivery update
- issue update
- monthly report

That keeps the app provider-neutral until a real delivery transport is added.

## Admin Automation Console

The admin console shows:

- pending events
- processed events
- failed events
- recent payloads

And provides manual actions for:

- processing events
- running low stock checks
- running overdue invoice checks
- running monthly automation

## Current Constraint

The existing RLS model still reserves actual monthly-closing writes for finance. Because of that, the automation console currently treats month-end automation as orchestration/preparation unless the task is later executed under a finance-capable context or a service-role background worker.
