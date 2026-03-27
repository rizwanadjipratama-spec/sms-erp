-- ============================================================
-- PHASE 12 - DOCUMENTS, EMAIL TEMPLATES, EXPORT PREP
-- ============================================================

begin;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  subject text not null,
  body_html text not null,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_templates_name_idx
on public.email_templates(name);

alter table public.email_templates enable row level security;
alter table public.email_templates force row level security;

drop policy if exists "email_templates_select_authenticated" on public.email_templates;
drop policy if exists "email_templates_insert_admin_owner" on public.email_templates;
drop policy if exists "email_templates_update_admin_owner" on public.email_templates;

create policy "email_templates_select_authenticated"
on public.email_templates
for select
to authenticated
using (true);

create policy "email_templates_insert_admin_owner"
on public.email_templates
for insert
to authenticated
with check (
  public.has_any_role(array['admin', 'owner'])
);

create policy "email_templates_update_admin_owner"
on public.email_templates
for update
to authenticated
using (
  public.has_any_role(array['admin', 'owner'])
)
with check (
  public.has_any_role(array['admin', 'owner'])
);

insert into public.email_templates (name, subject, body_html, variables)
values
  (
    'request_created',
    'Request Received - {{requestId}}',
    '<h1>Request Received</h1><p>Your request <strong>{{requestId}}</strong> has been submitted.</p><p>Status: {{status}}</p>',
    '["requestId","status","customerEmail"]'::jsonb
  ),
  (
    'request_approved',
    'Request Approved - {{requestId}}',
    '<h1>Request Approved</h1><p>Your request <strong>{{requestId}}</strong> has been approved.</p><p>{{message}}</p>',
    '["requestId","message","customerEmail"]'::jsonb
  ),
  (
    'request_rejected',
    'Request Rejected - {{requestId}}',
    '<h1>Request Rejected</h1><p>Your request <strong>{{requestId}}</strong> was rejected.</p><p>Reason: {{rejectionReason}}</p>',
    '["requestId","rejectionReason","customerEmail"]'::jsonb
  ),
  (
    'invoice_created',
    'Invoice Ready - {{invoiceNumber}}',
    '<h1>Invoice Created</h1><p>Invoice <strong>{{invoiceNumber}}</strong> is ready.</p><p>Amount: {{amount}}</p><p>Due date: {{dueDate}}</p>',
    '["invoiceNumber","amount","dueDate","customerEmail"]'::jsonb
  ),
  (
    'invoice_paid',
    'Invoice Paid - {{invoiceNumber}}',
    '<h1>Invoice Paid</h1><p>Invoice <strong>{{invoiceNumber}}</strong> has been marked paid.</p><p>Amount: {{amount}}</p>',
    '["invoiceNumber","amount","customerEmail"]'::jsonb
  ),
  (
    'order_ready',
    'Order Ready - {{requestId}}',
    '<h1>Order Ready</h1><p>Your order <strong>{{requestId}}</strong> is ready for delivery.</p>',
    '["requestId","customerEmail"]'::jsonb
  ),
  (
    'order_delivered',
    'Order Delivered - {{requestId}}',
    '<h1>Order Delivered</h1><p>Your order <strong>{{requestId}}</strong> has been delivered.</p><p>{{message}}</p>',
    '["requestId","message","customerEmail"]'::jsonb
  ),
  (
    'issue_created',
    'Issue Created - {{requestId}}',
    '<h1>Issue Created</h1><p>An issue was reported for request <strong>{{requestId}}</strong>.</p><p>{{message}}</p>',
    '["requestId","message","customerEmail"]'::jsonb
  ),
  (
    'issue_resolved',
    'Issue Resolved - {{requestId}}',
    '<h1>Issue Resolved</h1><p>The issue for request <strong>{{requestId}}</strong> has been resolved.</p><p>{{message}}</p>',
    '["requestId","message","customerEmail"]'::jsonb
  ),
  (
    'monthly_report',
    'Monthly Report - {{monthLabel}}',
    '<h1>Monthly Report</h1><p>Attached is the monthly report for <strong>{{monthLabel}}</strong>.</p><p>Total sales: {{totalSales}}</p>',
    '["monthLabel","totalSales","paidSales","unpaidSales"]'::jsonb
  )
on conflict (name) do update
set
  subject = excluded.subject,
  body_html = excluded.body_html,
  variables = excluded.variables;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'text/csv', 'application/vnd.ms-excel']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_authenticated_select" on storage.objects;
drop policy if exists "documents_authenticated_insert" on storage.objects;
drop policy if exists "documents_authenticated_update" on storage.objects;

create policy "documents_authenticated_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'documents');

create policy "documents_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'documents');

create policy "documents_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'documents')
with check (bucket_id = 'documents');

commit;
