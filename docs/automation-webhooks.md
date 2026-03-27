# Automation Webhooks

## Overview

Phase 11 extends the automation queue into an external webhook dispatcher.

The system now uses three automation tables:

- `automation_events`
- `automation_webhooks`
- `automation_logs`

## Dispatch Flow

1. System code emits an event through `emitSystemEvent(...)`.
2. The event is stored in `automation_events` with status `pending`.
3. `processPendingEvents()` loads pending events.
4. Active webhooks for the matching `event_type` are loaded from `automation_webhooks`.
5. Each webhook receives a JSON `POST` payload:

```json
{
  "event": "request_approved",
  "timestamp": "2026-03-26T12:00:00.000Z",
  "data": {
    "...": "payload"
  }
}
```

6. Every webhook attempt is stored in `automation_logs`.
7. Event status is updated:
   - `processed` on success
   - `pending` while retries remain
   - `failed` after the retry cap is reached

## Retry Logic

- max retries: `3`
- retry count is stored on `automation_events.retry_count`
- last failure reason is stored on `automation_events.last_error`
- admin can manually requeue a failed event from the automation console

## Admin Pages

### `/dashboard/admin/automation`

- event queue overview
- process pending events
- run low stock checks
- run overdue invoice checks
- run monthly automation
- retry failed events
- inspect webhook logs

### `/dashboard/admin/automation/settings`

- add webhook by event type
- enable or disable webhook
- inspect webhook delivery logs

## Current Boundary

This phase adds the external automation trigger layer, but it does not:

- change workflow logic
- change RLS behavior for existing ERP tables
- introduce a dedicated background worker yet

The system is now ready for:

- n8n webhooks
- cron-triggered event processing
- future service-role background execution
