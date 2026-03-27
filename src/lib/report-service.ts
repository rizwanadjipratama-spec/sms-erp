import { handleServiceError } from './service-utils';
import { supabase } from './supabase';
import type { DbRequest, DeliveryLog, Invoice, InventoryLog } from '@/types/types';

function toDateRange(startDate: string, endDate: string, endField = 'created_at') {
  return {
    start: startDate ? new Date(startDate).toISOString() : null,
    end: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
    endField,
  };
}

export async function getSalesReport(startDate: string, endDate: string) {
  try {
    const range = toDateRange(startDate, endDate);
    let query = supabase.from('invoices').select('id, order_id, invoice_number, amount, paid, created_at');

    if (range.start) query = query.gte('created_at', range.start);
    if (range.end) query = query.lte('created_at', range.end);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const invoices = (data || []) as Invoice[];
    return {
      invoices,
      totalSales: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      paidSales: invoices.filter((invoice) => invoice.paid).reduce((sum, invoice) => sum + invoice.amount, 0),
      unpaidSales: invoices.filter((invoice) => !invoice.paid).reduce((sum, invoice) => sum + invoice.amount, 0),
      invoicesCount: invoices.length,
    };
  } catch (error) {
    throw handleServiceError('report-service', 'getSalesReport', error, { startDate, endDate });
  }
}

export async function getInventoryReport(startDate: string, endDate: string) {
  try {
    const range = toDateRange(startDate, endDate);
    let query = supabase.from('inventory_logs').select('*');

    if (range.start) query = query.gte('created_at', range.start);
    if (range.end) query = query.lte('created_at', range.end);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const logs = (data || []) as InventoryLog[];
    return {
      logs,
      inbound: logs.filter((log) => log.change > 0).reduce((sum, log) => sum + log.change, 0),
      outbound: logs.filter((log) => log.change < 0).reduce((sum, log) => sum + Math.abs(log.change), 0),
      adjustments: logs.filter((log) => ['manual_adjustment', 'returned_goods', 'correction'].includes(log.reason)).length,
    };
  } catch (error) {
    throw handleServiceError('report-service', 'getInventoryReport', error, { startDate, endDate });
  }
}

export async function getDeliveryReport(startDate: string, endDate: string) {
  try {
    const range = toDateRange(startDate, endDate, 'delivered_at');
    let query = supabase.from('delivery_logs').select('*');

    if (range.start) query = query.gte('delivered_at', range.start);
    if (range.end) query = query.lte('delivered_at', range.end);

    const { data, error } = await query.order('delivered_at', { ascending: false });
    if (error) throw new Error(error.message);

    const logs = (data || []) as DeliveryLog[];
    return {
      logs,
      deliveredCount: logs.length,
      withProof: logs.filter((log) => Boolean(log.proof_url)).length,
      technicians: [...new Set(logs.map((log) => log.technician_id))].length,
    };
  } catch (error) {
    throw handleServiceError('report-service', 'getDeliveryReport', error, { startDate, endDate });
  }
}

export async function getInvoiceReport(startDate: string, endDate: string) {
  const sales = await getSalesReport(startDate, endDate);
  return {
    ...sales,
    paidInvoices: sales.invoices.filter((invoice) => invoice.paid).length,
    unpaidInvoices: sales.invoices.filter((invoice) => !invoice.paid).length,
  };
}

export async function getCustomerReport(startDate: string, endDate: string) {
  try {
    const range = toDateRange(startDate, endDate);
    let invoicesQuery = supabase.from('invoices').select('order_id, amount, paid, created_at');
    let requestsQuery = supabase.from('requests').select('id, user_id, user_email');

  if (range.start) {
    invoicesQuery = invoicesQuery.gte('created_at', range.start);
    requestsQuery = requestsQuery.gte('created_at', range.start);
  }
  if (range.end) {
    invoicesQuery = invoicesQuery.lte('created_at', range.end);
    requestsQuery = requestsQuery.lte('created_at', range.end);
  }

    const [invoiceRes, requestRes] = await Promise.all([
      invoicesQuery,
      requestsQuery,
    ]);

    if (invoiceRes.error) throw new Error(invoiceRes.error.message);
    if (requestRes.error) throw new Error(requestRes.error.message);

    const invoices = (invoiceRes.data || []) as Invoice[];
    const requests = (requestRes.data || []) as DbRequest[];
    const requestMap = requests.reduce<Record<string, DbRequest>>((acc, request) => {
      acc[request.id] = request;
      return acc;
    }, {});

    const customers = invoices.reduce<Record<string, { userId: string; userEmail: string; total: number; invoices: number }>>(
      (acc, invoice) => {
        const request = requestMap[invoice.order_id];
        if (!request?.user_id) return acc;
        const current = acc[request.user_id] || {
          userId: request.user_id,
          userEmail: request.user_email || 'unknown',
          total: 0,
          invoices: 0,
        };
        current.total += invoice.amount;
        current.invoices += 1;
        acc[request.user_id] = current;
        return acc;
      },
      {}
    );

    return {
      customers: Object.values(customers).sort((a, b) => b.total - a.total),
      totalCustomers: Object.keys(customers).length,
    };
  } catch (error) {
    throw handleServiceError('report-service', 'getCustomerReport', error, { startDate, endDate });
  }
}
