'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { financeService } from '@/lib/finance-service';
import { canAccessRoute } from '@/lib/permissions';
import type { DbRequest, Invoice, MonthlyClosing } from '@/types/types';
import { getCurrentAuthUser } from '@/lib/workflow';

export default function FinanceDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [tab, setTab] = useState<'queue' | 'invoices' | 'closing'>('queue');
  const [fetching, setFetching] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [closingNotes, setClosingNotes] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/finance')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const nextData = await financeService.fetchDashboardData();
    setRequests(nextData.requests);
    setInvoices(nextData.invoices);
    setClosings(nextData.closings);
    setFetching(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    refreshAll();
  }, [profile, refreshAll]);

  useRealtimeTable('requests', undefined, {
    enabled: Boolean(profile),
    onEvent: refreshAll,
    debounceMs: 250,
    channelName: 'finance-requests',
  });

  useRealtimeTable('invoices', undefined, {
    enabled: Boolean(profile),
    onEvent: refreshAll,
    debounceMs: 250,
    channelName: 'finance-invoices',
  });

  useRealtimeTable('monthly_closing', undefined, {
    enabled: Boolean(profile),
    onEvent: refreshAll,
    debounceMs: 300,
    channelName: 'finance-monthly-closing',
  });

  const approved = useMemo(() => requests.filter((request) => request.status === 'approved'), [requests]);
  const invoiced = useMemo(() => requests.filter((request) => request.status === 'invoice_ready'), [requests]);
  const paidInvoices = useMemo(() => invoices.filter((invoice) => invoice.paid), [invoices]);
  const unpaidInvoices = useMemo(() => invoices.filter((invoice) => !invoice.paid), [invoices]);
  const paidTotal = useMemo(
    () => paidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    [paidInvoices]
  );
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return invoices
      .filter((invoice) => {
        const createdAt = new Date(invoice.created_at);
        return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear;
      })
      .reduce((sum, invoice) => sum + invoice.amount, 0);
  }, [invoices]);

  const generateInvoice = async (request: DbRequest) => {
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await financeService.createInvoiceForRequest({
        request,
        actor: {
          id: actor.id,
          email: actor.email || profile?.email,
          role: profile.role,
        },
      });
      await refreshAll();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Invoice generation failed');
    } finally {
      setProcessingId(null);
    }
  };

  const markPaid = async (invoice: Invoice) => {
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId(invoice.id);
    try {
      const actor = await getCurrentAuthUser();
      await financeService.markInvoicePaid({
        invoice,
        actor: {
          id: actor.id,
          email: actor.email || profile?.email,
          role: profile.role,
        },
      });
      await refreshAll();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to mark invoice paid');
    } finally {
      setProcessingId(null);
    }
  };

  const closeCurrentMonth = async () => {
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId('monthly-close');
    try {
      const actor = await getCurrentAuthUser();
      await financeService.runMonthlyClosing({
        actor: {
          id: actor.id,
          email: actor.email || profile?.email,
          role: profile.role,
        },
        notes: closingNotes || undefined,
      });
      setClosingNotes('');
      await refreshAll();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to close month');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">Finance</h1>
        <p className="text-apple-text-secondary text-sm mt-1">Invoice management, payments, and monthly closing.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Needs Invoice', value: approved.length, color: 'text-apple-warning' },
          { label: 'Invoice Ready', value: invoiced.length, color: 'text-apple-blue' },
          { label: 'Unpaid Invoices', value: unpaidInvoices.length, color: 'text-apple-danger' },
          { label: 'Monthly Revenue', value: `Rp${monthlyRevenue.toLocaleString('id-ID')}`, color: 'text-apple-success' },
          { label: 'Paid Revenue', value: `Rp${paidTotal.toLocaleString('id-ID')}`, color: 'text-apple-success' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-apple-gray-border rounded-apple p-4 shadow-sm">
            <p className="text-apple-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-apple-gray-bg border border-apple-gray-border p-1 rounded-apple w-fit">
        {(['queue', 'invoices', 'closing'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
              tab === item 
                ? 'bg-white text-apple-text-primary shadow-sm' 
                : 'text-apple-text-secondary hover:text-apple-text-primary'
            }`}
          >
            {item === 'queue' ? 'Invoice Queue' : item === 'invoices' ? 'Invoices' : 'Monthly Closing'}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <section className="space-y-4">
          {approved.length === 0 ? (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 text-center text-gray-500">
              No approved requests waiting for invoicing
            </div>
          ) : (
            approved.map((request) => (
              <div key={request.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{request.user_email || request.user_id}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                    APPROVED
                  </span>
                </div>
                <div className="text-sm text-gray-500 mb-4 space-y-1">
                  {request.items.map((item, index) => (
                    <p key={`${request.id}-${index}`}>{item.name || item.id} x{item.qty}</p>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-gray-900">
                    {request.price_total ? `Rp${request.price_total.toLocaleString('id-ID')}` : 'Price not set'}
                  </p>
                  <button
                    onClick={() => generateInvoice(request)}
                    disabled={processingId === request.id}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {processingId === request.id ? 'Generating...' : 'Generate Invoice'}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'invoices' && (
        <section className="space-y-3">
          {invoices.length === 0 ? (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 text-center text-gray-500">
              No invoices yet
            </div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(invoice.created_at).toLocaleDateString('id-ID')} • Due: {invoice.due_date}
                  </p>
                  <p className="text-sm text-gray-900 mt-1">
                    Rp{invoice.amount.toLocaleString('id-ID')}
                    <span className="text-gray-500 text-xs"> (+Rp{(invoice.tax_amount || 0).toLocaleString('id-ID')} tax)</span>
                  </p>
                </div>
                <div className="text-right">
                  {invoice.paid ? (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full">
                      PAID
                    </span>
                  ) : (
                    <button
                      onClick={() => markPaid(invoice)}
                      disabled={processingId === invoice.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {processingId === invoice.id ? 'Saving...' : 'Mark Paid'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'closing' && (
        <section className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Close Current Month</h2>
              <p className="text-sm text-gray-500 mt-1">
                Snapshot finance totals from invoices into the monthly closing table.
              </p>
            </div>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={4}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 resize-none"
              placeholder="Notes for this closing..."
            />
            <button
              onClick={closeCurrentMonth}
              disabled={processingId === 'monthly-close'}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {processingId === 'monthly-close' ? 'Closing...' : 'Run Monthly Closing'}
            </button>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Closing History</h2>
            <div className="space-y-3">
              {closings.length === 0 ? (
                <p className="text-sm text-gray-500">No monthly closings yet.</p>
              ) : (
                closings.map((closing) => (
                  <div key={closing.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                    <p className="text-sm font-medium text-gray-900">
                      {String(closing.month).padStart(2, '0')}/{closing.year}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Revenue Rp{closing.total_revenue.toLocaleString('id-ID')} • Orders {closing.orders_count}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Paid {closing.paid_invoices} • Unpaid {closing.unpaid_invoices}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
