# Delivery Architecture

## Core Model

Delivery is handled as a dedicated domain service in [delivery-service.ts](../src/lib/delivery-service.ts).

The system uses:

- `requests` for delivery workflow state
- `delivery_logs` for delivery completion evidence
- Supabase Storage for optional proof uploads

The workflow engine remains the status authority, but the delivery service owns:

- technician claim logic
- proof upload
- delivery log creation
- delivery analytics

## Delivery Workflow

### Ready to on-delivery

1. Technician sees `ready` jobs.
2. `deliveryService.startDelivery(...)` checks:
   - actor role is `technician`
   - request status is `ready`
   - request is not already assigned to another technician
3. The service writes a `delivery_claimed` activity log.
4. The service calls the workflow engine to move:
   - `ready -> on_delivery`
5. The workflow engine writes the request transition log and notifies:
   - requester
   - admin
   - owner

At this point `assigned_technician_id` is set to the current technician.

### On-delivery to delivered

1. Assigned technician uploads optional proof.
2. `deliveryService.completeDelivery(...)` checks:
   - actor role is `technician`
   - request status is `on_delivery`
   - `assigned_technician_id` matches the acting technician
3. The service inserts a `delivery_logs` row.
4. The service writes a `delivery_log_created` activity log.
5. The service calls the workflow engine to move:
   - `on_delivery -> delivered`
6. The workflow engine writes the request transition log and notifies:
   - client
   - admin
   - owner

## Delivery Logs Model

Each delivery log includes:

- `order_id`
- `technician_id`
- `proof_url`
- `signature_url`
- `note`
- `delivered_at`
- `created_at`

The migration [supabase_delivery_phase8.sql](../supabase_delivery_phase8.sql) adds:

- a unique index on `delivery_logs.order_id`
- delivery reporting indexes
- request delivery timestamp columns

## Technician Dashboard Logic

The technician dashboard is now a thin UI over the delivery service:

- `fetchTechnicianDashboardData(...)` loads:
  - ready jobs
  - active deliveries
  - delivered requests
  - recent delivery logs
- `uploadProof(...)` handles storage upload
- `startDelivery(...)` claims a job
- `completeDelivery(...)` writes the delivery log and finishes the workflow step

The dashboard now shows:

- ready jobs
- my active deliveries
- delivery history
- uploaded proof links

## Assignment Enforcement

Assignment is enforced at three layers:

- delivery service checks request assignment before completion
- workflow engine validates technician identity for `on_delivery` and `delivered`
- RLS limits request and delivery log access to the assigned technician

## Delivery Analytics

The delivery service now exposes `getDeliveryAnalytics()` with:

- deliveries per technician
- average delivery time in hours
- deliveries per month

The analytics are derived from:

- `delivery_logs.technician_id`
- `delivery_logs.delivered_at`
- `requests.on_delivery_at`
- `requests.delivered_at`

This gives owner-level delivery performance reporting without coupling analytics logic to the dashboard page.

## Current Limitation

Proof upload remains optional. If delivery proof becomes mandatory for certain customers or product categories, that rule should move into the delivery service and database workflow contract rather than staying as a page-level convention.
