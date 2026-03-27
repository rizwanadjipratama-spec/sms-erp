import { supabase } from './supabase';
import type { EmailTemplate } from '@/types/types';

type TemplateSeed = Omit<EmailTemplate, 'id' | 'created_at'>;

const DEFAULT_EMAIL_TEMPLATES: TemplateSeed[] = [
  {
    name: 'request_created',
    subject: 'Request Received - {{requestId}}',
    body_html:
      '<h1>Request Received</h1><p>Your request <strong>{{requestId}}</strong> has been submitted.</p><p>Status: {{status}}</p>',
    variables: ['requestId', 'status', 'customerEmail'],
  },
  {
    name: 'request_approved',
    subject: 'Request Approved - {{requestId}}',
    body_html:
      '<h1>Request Approved</h1><p>Your request <strong>{{requestId}}</strong> has been approved.</p><p>{{message}}</p>',
    variables: ['requestId', 'message', 'customerEmail'],
  },
  {
    name: 'request_rejected',
    subject: 'Request Rejected - {{requestId}}',
    body_html:
      '<h1>Request Rejected</h1><p>Your request <strong>{{requestId}}</strong> was rejected.</p><p>Reason: {{rejectionReason}}</p>',
    variables: ['requestId', 'rejectionReason', 'customerEmail'],
  },
  {
    name: 'invoice_created',
    subject: 'Invoice Ready - {{invoiceNumber}}',
    body_html:
      '<h1>Invoice Created</h1><p>Invoice <strong>{{invoiceNumber}}</strong> is ready.</p><p>Amount: {{amount}}</p><p>Due date: {{dueDate}}</p>',
    variables: ['invoiceNumber', 'amount', 'dueDate', 'customerEmail'],
  },
  {
    name: 'invoice_paid',
    subject: 'Invoice Paid - {{invoiceNumber}}',
    body_html:
      '<h1>Invoice Paid</h1><p>Invoice <strong>{{invoiceNumber}}</strong> has been marked paid.</p><p>Amount: {{amount}}</p>',
    variables: ['invoiceNumber', 'amount', 'customerEmail'],
  },
  {
    name: 'order_ready',
    subject: 'Order Ready - {{requestId}}',
    body_html:
      '<h1>Order Ready</h1><p>Your order <strong>{{requestId}}</strong> is ready for delivery.</p>',
    variables: ['requestId', 'customerEmail'],
  },
  {
    name: 'order_delivered',
    subject: 'Order Delivered - {{requestId}}',
    body_html:
      '<h1>Order Delivered</h1><p>Your order <strong>{{requestId}}</strong> has been delivered.</p><p>{{message}}</p>',
    variables: ['requestId', 'message', 'customerEmail'],
  },
  {
    name: 'issue_created',
    subject: 'Issue Created - {{requestId}}',
    body_html:
      '<h1>Issue Created</h1><p>An issue was reported for request <strong>{{requestId}}</strong>.</p><p>{{message}}</p>',
    variables: ['requestId', 'message', 'customerEmail'],
  },
  {
    name: 'issue_resolved',
    subject: 'Issue Resolved - {{requestId}}',
    body_html:
      '<h1>Issue Resolved</h1><p>The issue for request <strong>{{requestId}}</strong> has been resolved.</p><p>{{message}}</p>',
    variables: ['requestId', 'message', 'customerEmail'],
  },
  {
    name: 'monthly_report',
    subject: 'Monthly Report - {{monthLabel}}',
    body_html:
      '<h1>Monthly Report</h1><p>Attached is the monthly report for <strong>{{monthLabel}}</strong>.</p><p>Total sales: {{totalSales}}</p>',
    variables: ['monthLabel', 'totalSales', 'paidSales', 'unpaidSales'],
  },
];

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderString(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => stringifyValue(data[key]));
}

function getFallbackTemplate(name: string): EmailTemplate {
  const template = DEFAULT_EMAIL_TEMPLATES.find((item) => item.name === name) || {
    name,
    subject: `ERP Notification - ${name}`,
    body_html: '<p>{{message}}</p>',
    variables: ['message'],
  };

  return {
    ...template,
    id: `default-${name}`,
    created_at: new Date().toISOString(),
  };
}

export async function getEmailTemplate(name: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.error('Email template lookup failed, using fallback template:', error.message);
    return getFallbackTemplate(name);
  }

  return (data as EmailTemplate | null) || getFallbackTemplate(name);
}

export async function renderEmailTemplate(name: string, data: Record<string, unknown>) {
  const template = await getEmailTemplate(name);
  return {
    template,
    subject: renderString(template.subject, data),
    bodyHtml: renderString(template.body_html, data),
  };
}

export function listDefaultEmailTemplates() {
  return DEFAULT_EMAIL_TEMPLATES.map((template) => ({ ...template }));
}
