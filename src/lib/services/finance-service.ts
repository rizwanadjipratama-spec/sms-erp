// ============================================================================
// FINANCE SERVICE — Invoicing, payments, and monthly closing
// ============================================================================

import { requestsDb, invoicesDb, monthlyClosingDb, activityLogsDb } from '@/lib/db';
import type { Actor, Invoice, InvoiceStatus, MonthlyClosing, PaginationParams } from '@/types/types';

export const financeService = {
  async getDashboard(branchId?: string) {
    const [approvedRequests, allInvoices, closings] = await Promise.all([
      requestsDb.getByStatus(['approved', 'invoice_ready'], undefined, branchId),
      invoicesDb.getAll({ branchId }),
      monthlyClosingDb.getAll(),
    ]);

    const paidInvoices = allInvoices.data.filter(i => i.status === 'paid');
    const unpaidInvoices = allInvoices.data.filter(i => ['issued', 'overdue'].includes(i.status));
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + i.total, 0);

    return {
      requests: approvedRequests.data,
      invoices: allInvoices.data,
      closings,
      stats: {
        totalRevenue,
        totalOutstanding,
        paidCount: paidInvoices.length,
        unpaidCount: unpaidInvoices.length,
        overdueCount: allInvoices.data.filter(i => i.status === 'overdue').length,
      },
    };
  },

  async createInvoice(orderId: string, actor: Actor): Promise<Invoice> {
    // Check if invoice already exists
    const existing = await invoicesDb.getByOrderId(orderId);
    if (existing) return existing;

    const request = await requestsDb.getById(orderId);
    if (!request) throw new Error('Request not found');

    const invoiceNumber = await invoicesDb.generateNumber();
    const subtotal = request.total_price;
    const taxRate = 0.11;
    const taxAmount = Math.round(subtotal * taxRate);
    const total = subtotal + taxAmount;

    const invoice = await invoicesDb.create({
      order_id: orderId,
      invoice_number: invoiceNumber,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      status: 'issued',
      issued_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      created_by: actor.id,
    });

    // Link invoice to request
    await requestsDb.update(orderId, { invoice_id: invoice.id });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'create_invoice',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: { order_id: orderId, invoice_number: invoiceNumber, total },
    });

    return invoice;
  },

  async markInvoicePaid(invoiceId: string, paymentMethod: string, paymentRef: string, actor: Actor): Promise<Invoice> {
    const invoice = await invoicesDb.update(invoiceId, {
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_ref: paymentRef,
      updated_by: actor.id,
    });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'mark_invoice_paid',
      entity_type: 'invoice',
      entity_id: invoiceId,
      metadata: { payment_method: paymentMethod, payment_ref: paymentRef },
    });

    return invoice;
  },

  async runMonthlyClosing(month: number, year: number, actor: Actor): Promise<MonthlyClosing> {
    const { data: invoices } = await invoicesDb.getAll();

    const monthInvoices = invoices.filter(i => {
      const d = new Date(i.created_at);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const paidInvoices = monthInvoices.filter(i => i.status === 'paid');
    const unpaidInvoices = monthInvoices.filter(i => ['issued', 'overdue'].includes(i.status));

    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalTax = paidInvoices.reduce((sum, i) => sum + i.tax_amount, 0);

    const closing = await monthlyClosingDb.upsert({
      month,
      year,
      total_revenue: totalRevenue,
      total_tax: totalTax,
      orders_count: monthInvoices.length,
      paid_invoices: paidInvoices.length,
      unpaid_invoices: unpaidInvoices.length,
      closed_by: actor.id,
    });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'monthly_closing',
      entity_type: 'monthly_closing',
      entity_id: closing.id,
      metadata: { month, year, total_revenue: totalRevenue },
    });

    return closing;
  },

  async getInvoices(filters?: { status?: InvoiceStatus[] }, pagination?: PaginationParams) {
    return invoicesDb.getAll(filters, pagination);
  },
};
