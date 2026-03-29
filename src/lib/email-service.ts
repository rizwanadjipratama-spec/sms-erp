import { logActivity } from './activity';
import { renderEmailTemplate } from './email-template-service';
import { pdfService } from './pdf-service';
import { getSalesReport } from './report-service';
import { handleServiceError, logServiceExecution, withOperationLock } from './service-utils';
import { supabase } from './supabase';
import type { DbRequest, DeliveryLog, EmailTemplate, Invoice, Profile } from '@/types/types';

type EmailAttachment = {
  filename: string;
  path: string;
  contentType?: string;
};

type EmailPayload = {
  to?: string[];
  subject: string;
  template: string;
  bodyHtml: string;
  data?: Record<string, unknown>;
  attachments?: EmailAttachment[];
};

type EmailResult = {
  queued: boolean;
  payload: EmailPayload;
  template: EmailTemplate;
};

type EventData = Record<string, unknown>;

function uniqueEmails(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean))] as string[];
}

function valueAsString(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

async function fetchProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [] as Profile[];

  const { data, error } = await supabase.from('profiles').select('id, email, name, role').in('id', ids);
  if (error) {
    console.error('Profile email lookup by ID failed:', error.message);
    return [] as Profile[];
  }
  return (data || []) as Profile[];
}

async function fetchProfilesByRoles(roles: string[]) {
  if (roles.length === 0) return [] as Profile[];

  const { data, error } = await supabase.from('profiles').select('id, email, name, role').in('role', roles);
  if (error) {
    console.error('Profile email lookup by role failed:', error.message);
    return [] as Profile[];
  }
  return (data || []) as Profile[];
}

async function resolveRecipients(data: EventData) {
  const notificationUserIds = Array.isArray(data.notificationUserIds)
    ? data.notificationUserIds.filter((item): item is string => typeof item === 'string')
    : [];
  const notificationRoles = Array.isArray(data.notificationRoles)
    ? data.notificationRoles.filter((item): item is string => typeof item === 'string')
    : [];

  const [profilesById, profilesByRole] = await Promise.all([
    fetchProfilesByIds(notificationUserIds),
    fetchProfilesByRoles(notificationRoles),
  ]);

  return uniqueEmails([
    ...(Array.isArray(data.recipientEmails)
      ? data.recipientEmails.filter((item): item is string => typeof item === 'string')
      : []),
    valueAsString(data.customerEmail) || null,
    valueAsString(data.actorEmail) || null,
    ...profilesById.map((profile) => profile.email),
    ...profilesByRole.map((profile) => profile.email),
  ]);
}

async function getRequestById(orderId: string) {
  const { data, error } = await supabase.from('requests').select('*').eq('id', orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DbRequest | null) || null;
}

async function getInvoiceContext(data: EventData) {
  const invoiceId = valueAsString(data.invoiceId || data.entityId);
  const orderId = valueAsString(data.orderId);

  let invoice: Invoice | null = null;
  if (invoiceId) {
    const invoiceRes = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (invoiceRes.error) throw new Error(invoiceRes.error.message);
    invoice = (invoiceRes.data as Invoice | null) || null;
  } else if (orderId) {
    const invoiceRes = await supabase.from('invoices').select('*').eq('order_id', orderId).maybeSingle();
    if (invoiceRes.error) throw new Error(invoiceRes.error.message);
    invoice = (invoiceRes.data as Invoice | null) || null;
  }

  if (!invoice) return { invoice: null, request: null };

  const request = await getRequestById(invoice.order_id);
  return { invoice, request };
}

async function getDeliveryContext(data: EventData) {
  const orderId = valueAsString(data.orderId || data.entityId);
  if (!orderId) return { deliveryLog: null, request: null };

  const [logRes, request] = await Promise.all([
    supabase.from('delivery_logs').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    getRequestById(orderId),
  ]);

  if (logRes.error) throw new Error(logRes.error.message);
  return {
    deliveryLog: (logRes.data as DeliveryLog | null) || null,
    request,
  };
}

function toAttachment(doc: { fileName: string; path: string; contentType: string }): EmailAttachment {
  return { filename: doc.fileName, path: doc.path, contentType: doc.contentType };
}

async function resolveAttachments(templateName: string, data: EventData): Promise<EmailAttachment[]> {
  if (templateName === 'invoice_created' || templateName === 'invoice_paid') {
    const { invoice, request } = await getInvoiceContext(data);
    if (!invoice) return [];
    return [toAttachment(await pdfService.generateInvoicePdf({ invoice, request }))];
  }

  if (templateName === 'order_delivered') {
    const { deliveryLog, request } = await getDeliveryContext(data);
    if (!deliveryLog) return [];
    return [toAttachment(await pdfService.generateDeliveryNotePdf({ deliveryLog, request }))];
  }

  if (templateName === 'monthly_report') {
    const month = Number(data.month) || new Date().getMonth() + 1;
    const year = Number(data.year) || new Date().getFullYear();
    const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const summary = await getSalesReport(monthStart, monthEnd);
    const monthLabel = valueAsString(data.monthLabel) || `${year}-${String(month).padStart(2, '0')}`;
    return [
      toAttachment(await pdfService.generateMonthlyReportPdf({
        monthLabel,
        summary,
      })),
    ];
  }

  return [];
}

async function queueTemplatedEmail(templateName: string, data: EventData): Promise<EmailResult> {
  const entityId = valueAsString(data.entityId || data.orderId || data.invoiceId || data.requestId || templateName);
  const actorId = valueAsString(data.actorId) || 'system';

  return withOperationLock(`email:${templateName}:${entityId}`, async () => {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'email-service',
      action: 'queueTemplatedEmail',
      stage: 'start',
      startedAt,
      metadata: {
        templateName,
        entityId,
        actorId,
      },
    });
    try {
      const [rendered, to, attachments] = await Promise.all([
        renderEmailTemplate(templateName, data),
        resolveRecipients(data),
        resolveAttachments(templateName, data),
      ]);

      const payload: EmailPayload = {
        to,
        subject: rendered.subject,
        template: templateName,
        bodyHtml: rendered.bodyHtml,
        data,
        attachments,
      };

      await logActivity(
        actorId,
        'email_queued',
        'email',
        entityId,
        {
          template: templateName,
          recipients: to,
          attachments: attachments.map((attachment) => attachment.path),
        },
        valueAsString(data.actorEmail) || undefined
      );

      console.info('[email-queued]', payload);
      await logServiceExecution({
        service: 'email-service',
        action: 'queueTemplatedEmail',
        stage: 'success',
        startedAt,
        metadata: {
          templateName,
          entityId,
          actorId,
          recipients: to.length,
          attachments: attachments.length,
        },
      });
      return {
        queued: true,
        payload,
        template: rendered.template,
      };
    } catch (error) {
      await logServiceExecution({
        service: 'email-service',
        action: 'queueTemplatedEmail',
        stage: 'failure',
        startedAt,
        metadata: {
          templateName,
          entityId,
          actorId,
        },
      });
      throw handleServiceError('email-service', 'queueTemplatedEmail', error, {
        templateName,
        entityId,
      });
    }
  });
}

function resolveApprovalTemplate(data: EventData) {
  return valueAsString(data._eventType) === 'request_rejected' ? 'request_rejected' : 'request_approved';
}

function resolveInvoiceTemplate(data: EventData) {
  return valueAsString(data._eventType) === 'invoice_paid' ? 'invoice_paid' : 'invoice_created';
}

function resolveDeliveryTemplate(data: EventData) {
  return valueAsString(data._eventType) === 'order_delivered' ? 'order_delivered' : 'order_ready';
}

export function sendRequestCreatedEmail(data: EventData) {
  return queueTemplatedEmail('request_created', data);
}

export function sendApprovalEmail(data: EventData) {
  return queueTemplatedEmail(resolveApprovalTemplate(data), data);
}

export function sendInvoiceEmail(data: EventData) {
  return queueTemplatedEmail(resolveInvoiceTemplate(data), data);
}

export function sendDeliveryEmail(data: EventData) {
  return queueTemplatedEmail(resolveDeliveryTemplate(data), data);
}

export function sendIssueEmail(data: EventData) {
  return queueTemplatedEmail(
    valueAsString(data._eventType) === 'issue_resolved' ? 'issue_resolved' : 'issue_created',
    data
  );
}

export function sendMonthlyReportEmail(data: EventData) {
  return queueTemplatedEmail('monthly_report', {
    ...data,
    monthLabel:
      valueAsString(data.monthLabel) ||
      `${valueAsString(data.year) || new Date().getFullYear()}-${String(Number(data.month) || new Date().getMonth() + 1).padStart(2, '0')}`,
  });
}
