# Finance Architecture

## Core Model

Finance is centered on `invoices` and `monthly_closing`.

- `requests` provide the operational source for invoice creation
- `invoices` provide the financial source for payment and revenue tracking
- `monthly_closing` stores finance snapshots derived from invoices

The finance service is implemented in [finance-service.ts](../src/lib/finance-service.ts).

## Invoice Flow

### Approved to invoice-ready

1. Finance reviews requests in `approved`.
2. The dashboard calls `financeService.createInvoiceForRequest(...)`.
3. The service checks:
   - actor role is `finance`
   - request status is `approved`
   - no existing invoice already exists for that request
4. The service generates the next invoice number in the format:
   - `INV/YYYY/MM/XXXX`
5. The service inserts the invoice row.
6. The service logs an `invoice_created` activity event.
7. The service calls the workflow engine to move:
   - `approved -> invoice_ready`
8. The workflow engine logs the request transition and notifies the next actors.

This keeps invoice creation and workflow transition connected, while still separating invoice-domain logging from request-domain logging.

## Invoice Numbering

Invoice numbers now follow:

- `INV/YYYY/MM/XXXX`

The service derives the next number by:

- reading the latest invoice for the current year and month
- incrementing the 4-digit suffix

The database migration [supabase_finance_phase7.sql](../supabase_finance_phase7.sql) adds:

- a unique index on `invoices.order_id`
- a format check on `invoice_number`

That means each request gets only one invoice, and invoice numbers stay structurally valid.

## Payment Flow

1. Finance marks an invoice as paid from the dashboard.
2. `financeService.markInvoicePaid(...)` updates:
   - `paid = true`
   - `paid_at = now()`
3. The service logs an `invoice_mark_paid` activity event.
4. The service sends notifications to:
   - the request owner
   - admin
   - owner

Payment does not change request workflow status directly. The current operating model keeps payment as a finance event while fulfillment continues from `invoice_ready`.

## Monthly Closing Logic

Monthly closing is derived from the `invoices` table.

`financeService.runMonthlyClosing(...)`:

- loads invoices created in the selected calendar month
- calculates:
  - total revenue
  - paid invoice count
  - unpaid invoice count
  - paid revenue for logging metadata
- upserts into `monthly_closing`
- logs a `monthly_closing_create` activity event
- notifies owner

This makes `invoices` the financial source of truth for monthly revenue snapshots.

## Dashboard Logic

The finance dashboard now acts as a thin UI over the finance service:

- `fetchDashboardData()` loads approved requests, invoices, and closing history
- approved requests appear in the invoice queue
- invoices tab shows paid and unpaid invoices
- dashboard stats show:
  - approved orders needing invoices
  - invoice-ready requests
  - unpaid invoices
  - monthly revenue
  - paid revenue
- closing tab writes monthly snapshots from invoices

## Logging and Notifications

Finance actions now generate dedicated finance-domain audit events:

- `invoice_created`
- `invoice_mark_paid`
- `monthly_closing_create`

Notifications are generated for:

- invoice creation through the workflow transition path
- invoice payment through the finance service
- monthly closing completion for owner

## Current Limitation

Invoice number generation is still done at the application layer. The database now enforces uniqueness and format, but fully race-proof numbering should eventually move to a database sequence or a secured RPC that generates and inserts the invoice inside one authoritative transaction.
