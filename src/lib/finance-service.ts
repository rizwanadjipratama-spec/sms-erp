import { logActivity } from './activity';
import { handleServiceError, logServiceExecution, withOperationLock } from './service-utils';
import { createNotificationsForUsers, fetchProfilesByRoles } from './workflow';
import { supabase, requireAuthUser } from './supabase';
import { workflowEngine } from './workflow-engine';
import type { DbRequest, Invoice, MonthlyClosing, UserRole } from '@/types/types';

type FinanceActor = {
  id: string;
  email?: string;
  role: UserRole;
};

type FinanceDashboardData = {
  requests: DbRequest[];
  invoices: Invoice[];
  closings: MonthlyClosing[];
};

function assertFinanceActor(role: UserRole) {
  if (role !== 'finance') {
    throw new Error('Only finance can perform invoice actions');
  }
}

function formatInvoiceNumber(date: Date, sequence: number) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV/${year}/${month}/${String(sequence).padStart(4, '0')}`;
}

async function getNextInvoiceNumber(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `INV/${year}/${month}/`;

  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }

  const latest = data?.[0]?.invoice_number as string | undefined;
  const latestSequence = latest ? Number(latest.split('/').pop() || '0') : 0;
  return formatInvoiceNumber(date, latestSequence + 1);
}

async function getRequestOwnerId(orderId: string) {
  const { data, error } = await supabase
    .from('requests')
    .select('user_id')
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return data?.user_id as string | undefined;
}

export const financeService = {
  async fetchDashboardData(): Promise<FinanceDashboardData> {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'finance-service',
      action: 'fetchDashboardData',
      stage: 'start',
      startedAt,
    });
    try {
      const [requestRes, invoiceRes, closingRes] = await Promise.all([
        supabase
          .from('requests')
          .select('*, request_items(*, products(name))')
          .in('status', ['approved', 'invoice_ready'])
          .order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('monthly_closing').select('*').order('created_at', { ascending: false }),
      ]);

      if (requestRes.error) {
        console.error('Supabase error:', requestRes.error);
        throw new Error(requestRes.error.message);
      }
      if (invoiceRes.error) {
        console.error('Supabase error:', invoiceRes.error);
        throw new Error(invoiceRes.error.message);
      }
      if (closingRes.error) {
        console.error('Supabase error:', closingRes.error);
        throw new Error(closingRes.error.message);
      }

      await logServiceExecution({
        service: 'finance-service',
        action: 'fetchDashboardData',
        stage: 'success',
        startedAt,
        metadata: {
          requests: requestRes.data?.length || 0,
          invoices: invoiceRes.data?.length || 0,
          closings: closingRes.data?.length || 0,
        },
      });

      return {
        requests: (requestRes.data || []) as any[],
        invoices: (invoiceRes.data || []) as Invoice[],
        closings: (closingRes.data || []) as MonthlyClosing[],
      };
    } catch (error) {
      await logServiceExecution({
        service: 'finance-service',
        action: 'fetchDashboardData',
        stage: 'failure',
        startedAt,
      });
      throw handleServiceError('finance-service', 'fetchDashboardData', error);
    }
  },

  async createInvoiceForRequest(params: {
    request: DbRequest;
    actor: FinanceActor;
    notes?: string;
    dueDate?: string;
  }) {
    return withOperationLock(`finance:create-invoice:${params.request.id}`, async () => {
      await requireAuthUser();
      const { request, actor, notes, dueDate } = params;
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'finance-service',
        action: 'createInvoiceForRequest',
        stage: 'start',
        startedAt,
        metadata: {
          requestId: request.id,
          actorId: actor.id,
        },
      });
      try {
        assertFinanceActor(actor.role);

        if (request.status !== 'approved' && request.status !== 'invoice_ready') {
          throw new Error('Only approved requests can be invoiced');
        }

        if ((request.total_price || 0) <= 0) {
          throw new Error('Request must have a valid total_price before invoice creation');
        }

        const existingRes = await supabase
          .from('invoices')
          .select('*')
          .eq('order_id', request.id)
          .maybeSingle();

        if (existingRes.error) {
          console.error('Supabase error:', existingRes.error);
          throw new Error(existingRes.error.message);
        }
        if (existingRes.data) {
          await logServiceExecution({
            service: 'finance-service',
            action: 'createInvoiceForRequest',
            stage: 'success',
            startedAt,
            metadata: {
              requestId: request.id,
              actorId: actor.id,
              invoiceId: existingRes.data.id,
              reused: true,
            },
          });
          return existingRes.data as Invoice;
        }

        const invoiceDate = new Date();
        const invoiceNumber = await getNextInvoiceNumber(invoiceDate);
        const finalDueDate =
          dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('invoices')
          .insert({
            order_id: request.id,
            invoice_number: invoiceNumber,
            total: request.total_price || 0,
            status: 'unpaid',
            issued_at: invoiceDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) {
          const duplicateInvoiceRes = await supabase
            .from('invoices')
            .select('*')
            .eq('order_id', request.id)
            .maybeSingle();
          if (duplicateInvoiceRes.data) {
            await logServiceExecution({
              service: 'finance-service',
              action: 'createInvoiceForRequest',
              stage: 'success',
              startedAt,
              metadata: {
                requestId: request.id,
                actorId: actor.id,
                invoiceId: duplicateInvoiceRes.data.id,
                reused: true,
              },
            });
            return duplicateInvoiceRes.data as Invoice;
          }
          throw new Error(error.message);
        }

        const invoice = data as Invoice;

        await logActivity(
          actor.id,
          'invoice_created',
          'invoice',
          invoice.id,
          {
            order_id: request.id,
            invoice_number: invoice.invoice_number,
            total: invoice.total,
          },
          actor.email
        );

        if (request.status === 'approved') {
          await workflowEngine.transitionOrder({
            request,
            actorId: actor.id,
            actorEmail: actor.email,
            actorRole: actor.role,
            nextStatus: 'invoice_ready',
            action: 'invoice_create',
            message: `Invoice ${invoice.invoice_number} is ready for request ${request.id}`,
            type: 'success',
            notifyRoles: ['warehouse', 'admin', 'owner'],
            metadata: {
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              total: invoice.total,
            },
          });
        }

        await logServiceExecution({
          service: 'finance-service',
          action: 'createInvoiceForRequest',
          stage: 'success',
          startedAt,
          metadata: {
            requestId: request.id,
            actorId: actor.id,
            invoiceId: invoice.id,
          },
        });

        return invoice;
      } catch (error) {
        await logServiceExecution({
          service: 'finance-service',
          action: 'createInvoiceForRequest',
          stage: 'failure',
          startedAt,
          metadata: {
            requestId: params.request.id,
            actorId: params.actor.id,
          },
        });
        throw handleServiceError('finance-service', 'createInvoiceForRequest', error, {
          requestId: params.request.id,
          actorId: params.actor.id,
        });
      }
    });
  },

  async markInvoicePaid(params: { invoice: Invoice; actor: FinanceActor }) {
    return withOperationLock(`finance:mark-paid:${params.invoice.id}`, async () => {
      await requireAuthUser();
      const { invoice, actor } = params;
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'finance-service',
        action: 'markInvoicePaid',
        stage: 'start',
        startedAt,
        metadata: {
          invoiceId: invoice.id,
          actorId: actor.id,
        },
      });
      try {
        assertFinanceActor(actor.role);

        if (invoice.status === 'paid') {
          await logServiceExecution({
            service: 'finance-service',
            action: 'markInvoicePaid',
            stage: 'success',
            startedAt,
            metadata: {
              invoiceId: invoice.id,
              actorId: actor.id,
              alreadyPaid: true,
            },
          });
          return invoice;
        }

        const paidAt = new Date().toISOString();
        const { data, error } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            updated_at: paidAt,
          })
          .eq('id', invoice.id)
          .neq('status', 'paid')
          .select('*')
          .maybeSingle();

        if (error) {
          console.error('Supabase error:', error);
          throw new Error(error.message);
        }

        if (!data) {
          const existingRes = await supabase.from('invoices').select('*').eq('id', invoice.id).single();
          if (existingRes.error) {
            console.error('Supabase error:', existingRes.error);
            throw new Error(existingRes.error.message);
          }
          await logServiceExecution({
            service: 'finance-service',
            action: 'markInvoicePaid',
            stage: 'success',
            startedAt,
            metadata: {
              invoiceId: invoice.id,
              actorId: actor.id,
              reused: true,
            },
          });
          return existingRes.data as Invoice;
        }

        const updatedInvoice = data as Invoice;

        await logActivity(
          actor.id,
          'invoice_mark_paid',
          'invoice',
          invoice.id,
          {
            order_id: invoice.order_id,
            invoice_number: invoice.invoice_number,
            total: invoice.total,
            paid_at: paidAt,
          },
          actor.email
        );

        const requesterId = await getRequestOwnerId(invoice.order_id);
        const roleRecipients = await fetchProfilesByRoles(['admin', 'owner']);
        const recipientIds = [
          requesterId,
          ...roleRecipients.map((profile) => profile.id).filter(Boolean),
        ].filter(Boolean) as string[];

        await createNotificationsForUsers(
          recipientIds,
          `Invoice ${invoice.invoice_number} has been marked paid`,
          'success',
          invoice.order_id
        );

        await logServiceExecution({
          service: 'finance-service',
          action: 'markInvoicePaid',
          stage: 'success',
          startedAt,
          metadata: {
            invoiceId: invoice.id,
            actorId: actor.id,
          },
        });

        return updatedInvoice;
      } catch (error) {
        await logServiceExecution({
          service: 'finance-service',
          action: 'markInvoicePaid',
          stage: 'failure',
          startedAt,
          metadata: {
            invoiceId: params.invoice.id,
            actorId: params.actor.id,
          },
        });
        throw handleServiceError('finance-service', 'markInvoicePaid', error, {
          invoiceId: params.invoice.id,
          actorId: params.actor.id,
        });
      }
    });
  },

  async runMonthlyClosing(params: { actor: FinanceActor; notes?: string; date?: Date }) {
    const dateKey = params.date || new Date();
    return withOperationLock(
      `finance:monthly-closing:${dateKey.getFullYear()}-${dateKey.getMonth() + 1}`,
      async () => {
        await requireAuthUser();
        const { actor, notes, date = new Date() } = params;
        const startedAt = Date.now();
        await logServiceExecution({
          service: 'finance-service',
          action: 'runMonthlyClosing',
          stage: 'start',
          startedAt,
          metadata: {
            actorId: actor.id,
            month: date.getMonth() + 1,
            year: date.getFullYear(),
          },
        });
        try {
          assertFinanceActor(actor.role);

          const month = date.getMonth() + 1;
          const year = date.getFullYear();
          const start = new Date(year, date.getMonth(), 1).toISOString();
          const end = new Date(year, date.getMonth() + 1, 0, 23, 59, 59).toISOString();

          const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end);

          if (error) {
            console.error('Supabase error:', error);
            throw new Error(error.message);
          }

          const monthInvoices = (data || []) as Invoice[];
          const totalRevenue = monthInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
          const paidInvoices = monthInvoices.filter((invoice) => invoice.status === 'paid').length;
          const unpaidInvoices = monthInvoices.filter((invoice) => invoice.status !== 'paid').length;
          const paidRevenue = monthInvoices
            .filter((invoice) => invoice.status === 'paid')
            .reduce((sum, invoice) => sum + invoice.total, 0);

          const { data: closingData, error: upsertError } = await supabase
            .from('monthly_closing')
            .upsert(
              {
                month,
                year,
                total_revenue: totalRevenue,
                orders_count: monthInvoices.length,
                paid_invoices: paidInvoices,
                unpaid_invoices: unpaidInvoices,
                closed_by: actor.email || actor.id,
                notes: notes || null,
              },
              { onConflict: 'month,year' }
            )
            .select('*')
            .single();

          if (upsertError) {
            console.error('Supabase error:', upsertError);
            throw new Error(upsertError.message);
          }

          await logActivity(
            actor.id,
            'monthly_closing_create',
            'monthly_closing',
            `${year}-${String(month).padStart(2, '0')}`,
            {
              total_revenue: totalRevenue,
              paid_revenue: paidRevenue,
              invoices_count: monthInvoices.length,
              paid_invoices: paidInvoices,
              unpaid_invoices: unpaidInvoices,
            },
            actor.email
          );

          const ownerRecipients = await fetchProfilesByRoles(['owner']);
          await createNotificationsForUsers(
            ownerRecipients.map((profile) => profile.id).filter(Boolean) as string[],
            `Monthly closing completed for ${year}-${String(month).padStart(2, '0')}`,
            'info'
          );

          await logServiceExecution({
            service: 'finance-service',
            action: 'runMonthlyClosing',
            stage: 'success',
            startedAt,
            metadata: {
              actorId: actor.id,
              month,
              year,
              totalRevenue,
              invoicesCount: monthInvoices.length,
            },
          });

          return closingData as MonthlyClosing;
        } catch (error) {
          await logServiceExecution({
            service: 'finance-service',
            action: 'runMonthlyClosing',
            stage: 'failure',
            startedAt,
            metadata: {
              actorId: params.actor.id,
            },
          });
          throw handleServiceError('finance-service', 'runMonthlyClosing', error, {
            actorId: params.actor.id,
          });
        }
      }
    );
  },
};
