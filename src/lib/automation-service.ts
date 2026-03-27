import { logActivity } from './activity';
import { financeService } from './finance-service';
import {
  sendApprovalEmail,
  sendDeliveryEmail,
  sendInvoiceEmail,
  sendIssueEmail,
  sendMonthlyReportEmail,
  sendRequestCreatedEmail,
} from './email-service';
import { emitSystemEvent } from './events';
import { getSalesReport } from './report-service';
import { handleServiceError, isRateLimited, logServiceExecution, withOperationLock } from './service-utils';
import { supabase } from './supabase';
import { SYSTEM_USER_ID, SYSTEM_USER_EMAIL, MAX_EVENT_RETRIES, EVENT_BATCH_LIMIT } from './constants';
import type {
  AutomationEvent,
  AutomationLog,
  AutomationWebhook,
  UserRole,
} from '@/types/types';


type AutomationActor = {
  id: string;
  email?: string;
  role: UserRole;
};

function assertAutomationActor(role: UserRole) {
  if (!['admin', 'owner', 'finance'].includes(role)) {
    throw new Error('Only admin, owner, or finance can run automation tasks');
  }
}

function mapEmailDispatcher(eventType: string, payload: Record<string, unknown>) {
  const emailPayload = {
    ...payload,
    _eventType: eventType,
  };

  switch (eventType) {
    case 'request_created':
      return sendRequestCreatedEmail(emailPayload);
    case 'request_approved':
    case 'request_rejected':
      return sendApprovalEmail(emailPayload);
    case 'invoice_created':
    case 'invoice_paid':
    case 'invoice_overdue':
      return sendInvoiceEmail(emailPayload);
    case 'order_ready':
    case 'order_on_delivery':
    case 'order_delivered':
    case 'order_completed':
      return sendDeliveryEmail(emailPayload);
    case 'issue_created':
    case 'issue_resolved':
      return sendIssueEmail(emailPayload);
    case 'monthly_closing_created':
      return sendMonthlyReportEmail(emailPayload);
    default:
      return {
        queued: true,
        payload: { subject: 'Generic ERP Event', template: 'generic_event', data: emailPayload },
      };
  }
}

async function fetchActiveWebhooks(eventType: string) {
  const { data, error } = await supabase
    .from('automation_webhooks')
    .select('*')
    .eq('event_type', eventType)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as AutomationWebhook[];
}

async function createAutomationLog(log: Omit<AutomationLog, 'id' | 'created_at'>) {
  const { error } = await supabase.from('automation_logs').insert(log);
  if (error) throw new Error(error.message);
}

async function updateEventStatus(
  id: string,
  status: AutomationEvent['status'],
  retryCount?: number,
  lastError?: string | null
) {
  const updates: Record<string, unknown> = { status };
  if (typeof retryCount === 'number') updates.retry_count = retryCount;
  updates.last_error = lastError || null;

  if (status !== 'pending') {
    updates.processed_at = new Date().toISOString();
  } else {
    updates.processed_at = null;
  }

  const { error } = await supabase.from('automation_events').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
}

async function processSingleWebhook(event: AutomationEvent, webhook: AutomationWebhook) {
  const body = {
    event: event.event_type,
    timestamp: new Date().toISOString(),
    data: event.payload || {},
  };

  try {
    const existingSuccessRes = await supabase
      .from('automation_logs')
      .select('id')
      .eq('event_id', event.id)
      .eq('webhook_url', webhook.webhook_url)
      .eq('status', 'success')
      .maybeSingle();

    if (existingSuccessRes.error) throw new Error(existingSuccessRes.error.message);
    if (existingSuccessRes.data) {
      return;
    }

    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    await createAutomationLog({
      event_id: event.id,
      webhook_url: webhook.webhook_url,
      status: response.ok ? 'success' : 'failed',
      response: responseText || `${response.status} ${response.statusText}`,
    });

    await logActivity('system', 'webhook_sent', 'automation_event', event.id, {
      webhook_url: webhook.webhook_url,
      status: response.ok ? 'success' : 'failed',
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}: ${responseText || response.statusText}`);
    }
  } catch (error) {
    await createAutomationLog({
      event_id: event.id,
      webhook_url: webhook.webhook_url,
      status: 'failed',
      response: error instanceof Error ? error.message : 'Unknown webhook failure',
    });
    await logActivity(SYSTEM_USER_ID, 'webhook_failed', 'automation_event', event.id, {
      webhook_url: webhook.webhook_url,
      error: error instanceof Error ? error.message : 'Unknown webhook failure',
    });
    throw error;
  }
}

async function processSingleEvent(event: AutomationEvent) {
  await automationService.sendEmailNotification(event);

  const webhooks = await fetchActiveWebhooks(event.event_type);
  if (webhooks.length === 0) {
    await updateEventStatus(event.id, 'processed', event.retry_count || 0, null);
    return { id: event.id, status: 'processed' as const, processedWebhooks: 0 };
  }

  try {
    for (const webhook of webhooks) {
      await processSingleWebhook(event, webhook);
    }

    await updateEventStatus(event.id, 'processed', event.retry_count || 0, null);
    return { id: event.id, status: 'processed' as const, processedWebhooks: webhooks.length };
  } catch (error) {
    const nextRetryCount = (event.retry_count || 0) + 1;
    const lastError = error instanceof Error ? error.message : 'Unknown processing error';

    if (nextRetryCount >= MAX_EVENT_RETRIES) {
      await updateEventStatus(event.id, 'failed', nextRetryCount, lastError);
      return { id: event.id, status: 'failed' as const, processedWebhooks: webhooks.length };
    }

    await updateEventStatus(event.id, 'pending', nextRetryCount, lastError);
    return { id: event.id, status: 'pending' as const, processedWebhooks: webhooks.length };
  }
}

export const automationService = {
  async getAutomationEvents(limit = 60) {
    try {
      const { data, error } = await supabase
        .from('automation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return (data || []) as AutomationEvent[];
    } catch (error) {
      throw handleServiceError('automation-service', 'getAutomationEvents', error, { limit });
    }
  },

  async getAutomationLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return (data || []) as AutomationLog[];
    } catch (error) {
      throw handleServiceError('automation-service', 'getAutomationLogs', error, { limit });
    }
  },

  async getAutomationWebhooks() {
    try {
      const { data, error } = await supabase
        .from('automation_webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as AutomationWebhook[];
    } catch (error) {
      throw handleServiceError('automation-service', 'getAutomationWebhooks', error);
    }
  },

  async saveWebhook(input: { eventType: string; webhookUrl: string; active?: boolean }) {
    const { data, error } = await supabase
      .from('automation_webhooks')
      .insert({
        event_type: input.eventType,
        webhook_url: input.webhookUrl,
        active: input.active ?? true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as AutomationWebhook;
  },

  async toggleWebhook(id: string, active: boolean) {
    const { data, error } = await supabase
      .from('automation_webhooks')
      .update({ active })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as AutomationWebhook;
  },

  async retryEvent(eventId: string) {
    try {
      const { error } = await supabase
        .from('automation_events')
        .update({
          status: 'pending',
          processed_at: null,
          last_error: null,
        })
        .eq('id', eventId);

      if (error) throw new Error(error.message);
    } catch (error) {
      throw handleServiceError('automation-service', 'retryEvent', error, { eventId });
    }
  },

  async processPendingEvents() {
    return withOperationLock('automation:process-pending', async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'automation-service',
        action: 'processPendingEvents',
        stage: 'start',
        startedAt,
      });
      try {
        if (isRateLimited('automation:process-pending', 3000)) {
          await logServiceExecution({
            service: 'automation-service',
            action: 'processPendingEvents',
            stage: 'success',
            startedAt,
            metadata: {
              rateLimited: true,
              batchLimit: EVENT_BATCH_LIMIT,
            },
          });
          return {
            results: [],
            processed: 0,
            batchLimit: EVENT_BATCH_LIMIT,
            durationMs: 0,
            rateLimited: true,
          };
        }

        const { data, error } = await supabase
          .from('automation_events')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(EVENT_BATCH_LIMIT);

        if (error) throw new Error(error.message);

        const events = (data || []) as AutomationEvent[];
        const results: Array<{ id: string; status: AutomationEvent['status']; processedWebhooks: number }> = [];

        for (const event of events) {
          const result = await processSingleEvent(event);
          results.push(result);
        }

        const durationMs = Date.now() - startedAt;
        console.info('[automation-batch]', {
          processed: results.length,
          batchLimit: EVENT_BATCH_LIMIT,
          durationMs,
        });

        await logServiceExecution({
          service: 'automation-service',
          action: 'processPendingEvents',
          stage: 'success',
          startedAt,
          metadata: {
            processed: results.length,
            batchLimit: EVENT_BATCH_LIMIT,
            durationMs,
          },
        });

        return {
          results,
          processed: results.length,
          batchLimit: EVENT_BATCH_LIMIT,
          durationMs,
          rateLimited: false,
        };
      } catch (error) {
        await logServiceExecution({
          service: 'automation-service',
          action: 'processPendingEvents',
          stage: 'failure',
          startedAt,
        });
        throw handleServiceError('automation-service', 'processPendingEvents', error);
      }
    });
  },

  async sendEmailNotification(event: AutomationEvent) {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'automation-service',
      action: 'sendEmailNotification',
      stage: 'start',
      startedAt,
      metadata: {
        eventId: event.id,
        eventType: event.event_type,
      },
    });
    try {
      const result = await mapEmailDispatcher(event.event_type, event.payload || {});
      await logServiceExecution({
        service: 'automation-service',
        action: 'sendEmailNotification',
        stage: 'success',
        startedAt,
        metadata: {
          eventId: event.id,
          eventType: event.event_type,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'automation-service',
        action: 'sendEmailNotification',
        stage: 'failure',
        startedAt,
        metadata: {
          eventId: event.id,
          eventType: event.event_type,
        },
      });
      throw handleServiceError('automation-service', 'sendEmailNotification', error, {
        eventId: event.id,
        eventType: event.event_type,
      });
    }
  },

  async sendWebhookEvent(event: AutomationEvent) {
    return withOperationLock(`automation:webhook:${event.id}`, async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'automation-service',
        action: 'sendWebhookEvent',
        stage: 'start',
        startedAt,
        metadata: {
          eventId: event.id,
          eventType: event.event_type,
        },
      });
      try {
        const webhooks = await fetchActiveWebhooks(event.event_type);
        for (const webhook of webhooks) {
          await processSingleWebhook(event, webhook);
        }
        await logServiceExecution({
          service: 'automation-service',
          action: 'sendWebhookEvent',
          stage: 'success',
          startedAt,
          metadata: {
            eventId: event.id,
            eventType: event.event_type,
            sent: webhooks.length,
          },
        });
        return {
          sent: webhooks.length,
          eventId: event.id,
        };
      } catch (error) {
        await logServiceExecution({
          service: 'automation-service',
          action: 'sendWebhookEvent',
          stage: 'failure',
          startedAt,
          metadata: {
            eventId: event.id,
            eventType: event.event_type,
          },
        });
        throw handleServiceError('automation-service', 'sendWebhookEvent', error, {
          eventId: event.id,
          eventType: event.event_type,
        });
      }
    });
  },

  async checkLowStock(actor: AutomationActor) {
    assertAutomationActor(actor.role);

    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock, status')
      .lt('stock', 5)
      .order('stock', { ascending: true });

    if (error) throw new Error(error.message);

    const products = (data || []) as Array<{ id: string; name: string; stock: number; status: string }>;
    const events = [];

    for (const product of products) {
      const event = await emitSystemEvent('low_stock_warning', {
        actorId: actor.id,
        actorEmail: actor.email,
        entityId: product.id,
        entityType: 'product',
        message: `Low stock warning for ${product.name}`,
        notificationRoles: ['warehouse', 'admin', 'owner'],
        productId: product.id,
        productName: product.name,
        stock: product.stock,
        productStatus: product.status,
      });
      events.push(event);
    }

    return events;
  },

  async checkOverdueInvoices(actor: AutomationActor) {
    assertAutomationActor(actor.role);

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, order_id, invoice_number, amount, due_date, paid')
      .eq('paid', false)
      .lt('due_date', today);

    if (error) throw new Error(error.message);

    const invoices = (data || []) as Array<{
      id: string;
      order_id: string;
      invoice_number: string;
      amount: number;
      due_date?: string;
      paid: boolean;
    }>;

    if (invoices.length === 0) {
      return [];
    }

    const requestRes = await supabase
      .from('requests')
      .select('id, user_id, user_email')
      .in('id', invoices.map((invoice) => invoice.order_id));

    if (requestRes.error) throw new Error(requestRes.error.message);

    const requestMap = ((requestRes.data || []) as Array<{ id: string; user_id?: string; user_email?: string }>).reduce<
      Record<string, { user_id?: string; user_email?: string }>
    >((acc, request) => {
      acc[request.id] = request;
      return acc;
    }, {});

    const events = [];
    for (const invoice of invoices) {
      const request = requestMap[invoice.order_id];
      const event = await emitSystemEvent('invoice_overdue', {
        actorId: actor.id,
        actorEmail: actor.email,
        entityId: invoice.id,
        entityType: 'invoice',
        orderId: invoice.order_id,
        message: `Invoice ${invoice.invoice_number} is overdue`,
        notificationRoles: ['finance', 'admin', 'owner'],
        notificationUserIds: request?.user_id ? [request.user_id] : [],
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        dueDate: invoice.due_date,
        amount: invoice.amount,
        customerEmail: request?.user_email || null,
      });
      events.push(event);
    }

    return events;
  },

  async runMonthlyAutomation(actor: AutomationActor) {
    assertAutomationActor(actor.role);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const salesReport = await getSalesReport(monthStart, monthEnd);
    let closing: Awaited<ReturnType<typeof financeService.runMonthlyClosing>> | null = null;

    if (actor.role === 'finance') {
      closing = await financeService.runMonthlyClosing({
        actor: {
          id: actor.id,
          email: actor.email,
          role: 'finance',
        },
        notes: 'Triggered by automation service',
      });
    }

    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const event = await emitSystemEvent('monthly_closing_created', {
      actorId: actor.id,
      actorEmail: actor.email,
      entityId: closing?.id,
      entityType: 'monthly_closing',
      message: `Monthly automation prepared for ${monthLabel}`,
      notificationRoles: ['owner', 'finance', 'admin'],
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      totalRevenue: closing?.total_revenue || salesReport.totalSales,
      ordersCount: closing?.orders_count || salesReport.invoicesCount,
      automationMode: closing ? 'closing_executed' : 'closing_prepared',
    });

    return {
      closing,
      salesReport,
      event,
    };
  },
};
