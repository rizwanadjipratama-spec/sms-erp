# Disaster Recovery

## Scope

Phase 17 introduces operational backup and restore support for:

- database snapshots
- storage snapshots
- full system snapshots

The implementation is centered on:

- `backup_logs`
- `backup-service.ts`
- `/dashboard/admin/backups`

## Database Backup Coverage

Database snapshots include:

- `profiles`
- `products`
- `price_list`
- `requests`
- `invoices`
- `inventory_logs`
- `delivery_logs`
- `issues`
- `notifications`
- `activity_logs`
- `monthly_closing`
- `payment_promises`
- `automation_events`
- `automation_webhooks`
- `automation_logs`
- `email_templates`
- `system_logs`

Snapshots are stored as JSON in the `documents` bucket under:

- `backups/database/*`
- `backups/full/*`

## Storage Backup Coverage

Storage snapshots include:

- `delivery-proofs`
- `documents`

The backup service copies source files into backup paths under:

- `documents/backups/storage/<backup-id>/...`

For the `documents` bucket, the service skips existing `backups/` paths to avoid recursive backup growth.

## Restore Model

Restore is intentionally non-destructive:

- database restore uses `upsert` by `id`
- storage restore re-uploads files with `upsert: true`

This means restore is safe for merge-style recovery, but it does not delete rows or files that were created after the snapshot.

## Verification

Backup verification currently checks:

- backup file exists
- JSON snapshot can be downloaded
- snapshot can be parsed successfully

This is a structural verification step, not a full checksum validation.

## Monthly Backup Automation

`backupService.runMonthlyBackup()` is available as the integration point for month-end automation. It:

1. runs a full backup
2. records backup logs
3. notifies owner users

This phase keeps the function ready for orchestration without changing the existing automation workflow code.

## Recommended Recovery Procedure

1. Open `/dashboard/admin/backups`.
2. Identify the latest `verified` or `completed` snapshot.
3. Download the backup artifact for offline retention.
4. Run `Verify` before restore if the snapshot was not recently checked.
5. Run `Restore`.
6. Validate:
   - request counts
   - invoice counts
   - recent storage files
   - automation queue health
   - system health dashboard

## Operational Notes

- Full backup success also notifies owner users.
- Backup activity is written to `activity_logs`.
- Backup execution and failures are written to `system_logs`.
- `backup_logs` is the operational source for history and status.
