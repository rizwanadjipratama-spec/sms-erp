import { getStockValue } from './analytics-service';
import { deliveryService } from './delivery-service';
import { handleServiceError } from './service-utils';
import { supabase } from './supabase';
import type { ActivityLog, InventoryLog, MonthlyClosing, SystemLog } from '@/types/types';

export type TimelineEntry = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  entityId?: string | null;
  actor?: string | null;
};

export type SystemHealthSnapshot = {
  database: {
    healthy: boolean;
    checkedAt: string;
  };
  automation: {
    pending: number;
    failed: number;
  };
  finance: {
    unpaidInvoices: number;
  };
  inventory: {
    lowStockItems: number;
  };
  issues: {
    openIssues: number;
  };
  monthlyClosing: {
    lastClosing: MonthlyClosing | null;
  };
  uptime: {
    status: 'online' | 'degraded';
    checkedAt: string;
  };
  metrics: {
    totalRequests: number;
    totalInvoices: number;
    totalDeliveries: number;
    totalRevenue: number;
    automationProcessed: number;
    automationFailed: number;
    emailsSent: number;
    pdfsGenerated: number;
    averageDeliveryHours: number;
    stockValue: number;
  };
  logs: {
    recentSystemLogs: SystemLog[];
  };
  timelines: {
    request: TimelineEntry[];
    invoice: TimelineEntry[];
    inventory: TimelineEntry[];
    delivery: TimelineEntry[];
  };
};

function labelForRequestAction(action: string) {
  const map: Record<string, string> = {
    request_submitted: 'Request Created',
    price_request: 'Priced',
    approve: 'Approved',
    reject: 'Rejected',
    invoice_create: 'Invoice Ready',
    preparing: 'Preparing',
    ready: 'Ready',
    delivery_start: 'On Delivery',
    delivery: 'Delivered',
    completed: 'Completed',
    issue: 'Issue Reported',
    resolved: 'Resolved',
  };
  return map[action] || action.replace(/_/g, ' ');
}

function buildActivityTimeline(logs: ActivityLog[], type: 'request' | 'invoice' | 'delivery'): TimelineEntry[] {
  return logs.map((log) => {
    if (type === 'invoice') {
      return {
        id: log.id,
        title: log.action === 'invoice_mark_paid' ? 'Invoice Paid' : 'Invoice Created',
        description: `Invoice ${log.entity_id || '-'} ${log.action === 'invoice_mark_paid' ? 'was marked paid' : 'was created'}`,
        timestamp: log.created_at,
        entityId: log.entity_id,
        actor: log.user_email || log.user_id,
      };
    }

    if (type === 'delivery') {
      const titleMap: Record<string, string> = {
        delivery_claimed: 'Delivery Claimed',
        delivery_start: 'Delivery Started',
        delivery_log_created: 'Delivery Log Created',
        delivery: 'Order Delivered',
      };
      return {
        id: log.id,
        title: titleMap[log.action] || log.action.replace(/_/g, ' '),
        description: `Order ${log.entity_id || '-'} ${log.action.replace(/_/g, ' ')}`,
        timestamp: log.created_at,
        entityId: log.entity_id,
        actor: log.user_email || log.user_id,
      };
    }

    return {
      id: log.id,
      title: labelForRequestAction(log.action),
      description: `Request ${log.entity_id || '-'} moved through ${labelForRequestAction(log.action).toLowerCase()}`,
      timestamp: log.created_at,
      entityId: log.entity_id,
      actor: log.user_email || log.user_id,
    };
  });
}

function buildInventoryTimeline(logs: InventoryLog[]): TimelineEntry[] {
  return logs.map((log) => ({
    id: log.id,
    title: log.change < 0 ? 'Stock Deducted' : 'Stock Added',
    description: `${log.reason.replace(/_/g, ' ')} on product ${log.product_id} (${log.change > 0 ? '+' : ''}${log.change})`,
    timestamp: log.created_at,
    entityId: log.order_id || log.product_id,
    actor: log.created_by || null,
  }));
}

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const checkedAt = new Date().toISOString();

  try {
    const [
      dbRes,
      pendingEventsRes,
      failedEventsRes,
      processedEventsRes,
      unpaidInvoicesRes,
      lowStockRes,
      openIssuesRes,
      closingRes,
      totalRequestsRes,
      totalInvoicesRes,
      totalDeliveriesRes,
      paidInvoicesRes,
      emailsSentRes,
      pdfGeneratedRes,
      systemLogsRes,
      requestTimelineRes,
      invoiceTimelineRes,
      deliveryTimelineRes,
      inventoryTimelineRes,
      deliveryAnalytics,
      stockValue,
    ] = await Promise.all([
      supabase.from('requests').select('*', { count: 'exact', head: true }).limit(1),
      supabase.from('automation_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('automation_events').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('automation_events').select('*', { count: 'exact', head: true }).eq('status', 'processed'),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).neq('status', 'paid'),
      supabase.from('products').select('*', { count: 'exact', head: true }).lt('stock', 5),
      supabase.from('issues').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
      supabase.from('monthly_closing').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('requests').select('*', { count: 'exact', head: true }),
      supabase.from('invoices').select('*', { count: 'exact', head: true }),
      supabase.from('delivery_logs').select('*', { count: 'exact', head: true }),
      supabase.from('invoices').select('total').eq('status', 'paid'),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action', 'email_queued'),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action', 'pdf_generated'),
      supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase
        .from('activity_logs')
        .select('id, user_id, user_email, action, entity_type, entity_id, metadata, created_at')
        .eq('entity_type', 'request')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('activity_logs')
        .select('id, user_id, user_email, action, entity_type, entity_id, metadata, created_at')
        .eq('entity_type', 'invoice')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('activity_logs')
        .select('id, user_id, user_email, action, entity_type, entity_id, metadata, created_at')
        .in('entity_type', ['delivery', 'delivery_log'])
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      deliveryService.getDeliveryAnalytics(),
      getStockValue(),
    ]);

    if (dbRes.error) {
      console.error('Supabase error:', dbRes.error);
      // Database health check failing is a special case, we might not want to throw immediately
      // but logic-wise, if the first head check fails, the DB is likely down.
    }
    const databaseHealthy = !dbRes.error;
    if (pendingEventsRes.error) {
      console.error('Supabase error:', pendingEventsRes.error);
      throw new Error(pendingEventsRes.error.message);
    }
    if (failedEventsRes.error) {
      console.error('Supabase error:', failedEventsRes.error);
      throw new Error(failedEventsRes.error.message);
    }
    if (processedEventsRes.error) {
      console.error('Supabase error:', processedEventsRes.error);
      throw new Error(processedEventsRes.error.message);
    }
    if (unpaidInvoicesRes.error) {
      console.error('Supabase error:', unpaidInvoicesRes.error);
      throw new Error(unpaidInvoicesRes.error.message);
    }
    if (lowStockRes.error) {
      console.error('Supabase error:', lowStockRes.error);
      throw new Error(lowStockRes.error.message);
    }
    if (openIssuesRes.error) {
      console.error('Supabase error:', openIssuesRes.error);
      throw new Error(openIssuesRes.error.message);
    }
    if (closingRes.error) {
      console.error('Supabase error:', closingRes.error);
      throw new Error(closingRes.error.message);
    }
    if (totalRequestsRes.error) {
      console.error('Supabase error:', totalRequestsRes.error);
      throw new Error(totalRequestsRes.error.message);
    }
    if (totalInvoicesRes.error) {
      console.error('Supabase error:', totalInvoicesRes.error);
      throw new Error(totalInvoicesRes.error.message);
    }
    if (totalDeliveriesRes.error) {
      console.error('Supabase error:', totalDeliveriesRes.error);
      throw new Error(totalDeliveriesRes.error.message);
    }
    if (paidInvoicesRes.error) {
      console.error('Supabase error:', paidInvoicesRes.error);
      throw new Error(paidInvoicesRes.error.message);
    }
    if (emailsSentRes.error) {
      console.error('Supabase error:', emailsSentRes.error);
      throw new Error(emailsSentRes.error.message);
    }
    if (pdfGeneratedRes.error) {
      console.error('Supabase error:', pdfGeneratedRes.error);
      throw new Error(pdfGeneratedRes.error.message);
    }
    if (systemLogsRes.error) {
      console.error('Supabase error:', systemLogsRes.error);
      throw new Error(systemLogsRes.error.message);
    }
    if (requestTimelineRes.error) {
      console.error('Supabase error:', requestTimelineRes.error);
      throw new Error(requestTimelineRes.error.message);
    }
    if (invoiceTimelineRes.error) {
      console.error('Supabase error:', invoiceTimelineRes.error);
      throw new Error(invoiceTimelineRes.error.message);
    }
    if (deliveryTimelineRes.error) {
      console.error('Supabase error:', deliveryTimelineRes.error);
      throw new Error(deliveryTimelineRes.error.message);
    }
    if (inventoryTimelineRes.error) {
      console.error('Supabase error:', inventoryTimelineRes.error);
      throw new Error(inventoryTimelineRes.error.message);
    }

    const paidRevenue = ((paidInvoicesRes.data || []) as Array<{ total: number }>).reduce(
      (sum, invoice) => sum + (invoice.total || 0),
      0
    );

    return {
      database: {
        healthy: databaseHealthy,
        checkedAt,
      },
      automation: {
        pending: pendingEventsRes.count || 0,
        failed: failedEventsRes.count || 0,
      },
      finance: {
        unpaidInvoices: unpaidInvoicesRes.count || 0,
      },
      inventory: {
        lowStockItems: lowStockRes.count || 0,
      },
      issues: {
        openIssues: openIssuesRes.count || 0,
      },
      monthlyClosing: {
        lastClosing: (closingRes.data as MonthlyClosing | null) || null,
      },
      uptime: {
        status: databaseHealthy ? 'online' : 'degraded',
        checkedAt,
      },
      metrics: {
        totalRequests: totalRequestsRes.count || 0,
        totalInvoices: totalInvoicesRes.count || 0,
        totalDeliveries: totalDeliveriesRes.count || 0,
        totalRevenue: paidRevenue,
        automationProcessed: processedEventsRes.count || 0,
        automationFailed: failedEventsRes.count || 0,
        emailsSent: emailsSentRes.count || 0,
        pdfsGenerated: pdfGeneratedRes.count || 0,
        averageDeliveryHours: deliveryAnalytics.averageDeliveryHours,
        stockValue,
      },
      logs: {
        recentSystemLogs: (systemLogsRes.data || []) as SystemLog[],
      },
      timelines: {
        request: buildActivityTimeline((requestTimelineRes.data || []) as ActivityLog[], 'request'),
        invoice: buildActivityTimeline((invoiceTimelineRes.data || []) as ActivityLog[], 'invoice'),
        delivery: buildActivityTimeline((deliveryTimelineRes.data || []) as ActivityLog[], 'delivery'),
        inventory: buildInventoryTimeline((inventoryTimelineRes.data || []) as InventoryLog[]),
      },
    };
  } catch (error) {
    throw handleServiceError('system-health-service', 'getSystemHealthSnapshot', error);
  }
}
