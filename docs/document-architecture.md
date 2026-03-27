# Document Architecture

## Scope

Phase 12 adds document generation and export support without changing workflow, permissions, or domain transition logic.

## Components

- `email_templates`
  Stores editable HTML email templates and variable definitions.
- `src/lib/email-template-service.ts`
  Loads templates from Supabase with safe local fallbacks and renders `{{variable}}` placeholders.
- `src/lib/email-service.ts`
  Builds queued email payloads, resolves recipients, and attaches generated documents.
- `src/lib/pdf-service.ts`
  Generates lightweight text-based PDFs and stores them in the `documents` bucket.
- `src/lib/export-service.ts`
  Produces Excel-compatible CSV exports from existing report-service data.

## Storage

- Bucket: `documents`
- Document folders:
  - `invoices/`
  - `delivery-notes/`
  - `reports/monthly/`
  - `reports/sales/`

## Generated Documents

- Invoice PDF
- Delivery Note PDF
- Monthly Report PDF
- Sales Report PDF
- CSV exports for sales, inventory, delivery, invoices, and customers

## Email Attachment Flow

1. Automation service maps an event to an email handler.
2. Email service resolves the template and recipients.
3. If the template type needs an attachment, email service generates and uploads the PDF.
4. The queued email payload includes attachment metadata:
   - filename
   - storage path
   - content type
   - signed URL when available

## Owner Reporting

`/dashboard/owner/reports` can now:

- load structured reports
- export CSV files for Excel
- generate a sales-report PDF and store it in Supabase Storage

## Notes

- PDF generation is intentionally lightweight and text-based so it works without adding a heavy PDF dependency.
- External email delivery is still not connected. Attachments are prepared and stored so the existing automation/email queue can hand them off later.
