// ============================================================================
// FINANCE SERVICE — Invoicing, payments, and monthly closing
// ============================================================================

import { requestsDb, invoicesDb, monthlyClosingDb, activityLogsDb } from '@/lib/db';
import { supabase } from '@/lib/supabase';
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

  async getDashboardRequests(branchId?: string) {
    const res = await requestsDb.getByStatus(['approved', 'invoice_ready'], undefined, branchId);
    return res.data;
  },

  async getDashboardInvoices(branchId?: string) {
    const res = await invoicesDb.getAll({ branchId });
    return res.data;
  },

  async getDashboardClosings() {
    return monthlyClosingDb.getAll();
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

    const existingTx = await supabase.from('financial_transactions').select('id').eq('reference_id', invoiceId).single();
    if (!existingTx.data) {
      await supabase.from('financial_transactions').insert({
        branch_id: invoice.branch_id,
        type: 'INFLOW',
        category: 'invoice_payment',
        amount: invoice.total,
        reference_id: invoice.id,
        description: `Payment for Invoice via ${paymentMethod} (Ref: ${paymentRef})`,
        created_by: actor.id,
      });
    }

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

  async runMonthlyClosing(month: number, year: number, branchId: string, actor: Actor): Promise<MonthlyClosing> {
    const paddedMonth = month.toString().padStart(2, '0');
    const periodStr = `${year}-${paddedMonth}`;

    const { error: rpcError } = await supabase.rpc('rpc_monthly_closing', {
      p_branch_id: branchId,
      p_month: periodStr,
      p_user_id: actor.id,
    });

    if (rpcError) {
      throw new Error(`RPC Monthly Closing Failed: ${rpcError.message}`);
    }

    // Fetch the newly created record to return it
    const { data: closingRecord, error: fetchError } = await supabase
      .from('monthly_closing')
      .select('*')
      .eq('branch_id', branchId)
      .eq('month', periodStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !closingRecord) {
      throw new Error('Could not retrieve monthly closing record after generation.');
    }

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'run_monthly_closing',
      entity_type: 'monthly_closing',
      entity_id: closingRecord.id,
      metadata: { month, year, branch_id: branchId },
    });

    return closingRecord as MonthlyClosing;
  },

  async getInvoices(filters?: { status?: InvoiceStatus[] }, pagination?: PaginationParams) {
    return invoicesDb.getAll(filters, pagination);
  },
};
