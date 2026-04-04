'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { financeService, workflowEngine, authService, fakturService } from '@/lib/services';
import { formatCurrency, formatDate, formatDateTime, formatOrderId } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Modal } from '@/components/ui/Modal';
import { OrderNotes } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { DbRequest, Invoice, MonthlyClosing, FakturTask, FakturTaskType, Profile } from '@/types/types';
import { useBranch } from '@/hooks/useBranch';
import FakturDispatchTab from './components/FakturDispatchTab';
import { SalesInvoicePrint } from '@/components/finance/SalesInvoicePrint';
import { DeliveryOrderPrint } from '@/components/finance/DeliveryOrderPrint';

type TabKey = 'queue' | 'invoices' | 'closing' | 'faktur_dispatch';

export default function FinanceDashboard() {
  const { profile, role, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('queue');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [paymentModal, setPaymentModal] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');


  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/finance')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching (SWR) ----------
  const fetchProfiles = async () => {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['faktur', 'client'])
      .eq('is_active', true);
    return profilesData || [];
  };

  const { data: requests = [], mutate: refreshRequests, error: errorReq } = useSWR(
    profile ? ['finance_requests', activeBranchId] : null,
    () => financeService.getDashboardRequests(activeBranchId)
  );

  const { data: invoices = [], mutate: refreshInvoices, error: errorInv } = useSWR(
    profile ? ['finance_invoices', activeBranchId] : null,
    () => financeService.getDashboardInvoices(activeBranchId)
  );

  const { data: closings = [], mutate: refreshClosings, error: errorClose } = useSWR(
    profile ? ['finance_closings', activeBranchId] : null,
    () => financeService.getDashboardClosings()
  );

  const { data: fakturTasks = [], mutate: refreshFakturTasks } = useSWR(
    profile ? ['finance_faktur_tasks'] : null,
    () => fakturService.getAllTasks()
  );

  const { data: profilesData = [] } = useSWR(
    profile ? ['finance_profiles'] : null,
    fetchProfiles
  );

  const fakturUsers = useMemo(() => profilesData.filter(p => p.role === 'faktur'), [profilesData]);
  const clients = useMemo(() => profilesData.filter(p => p.role === 'client'), [profilesData]);

  const [printRequest, setPrintRequest] = useState<DbRequest | null>(null);
  const [printMode, setPrintMode] = useState<'invoice' | 'do'>('invoice');
  const printTriggerRef = useRef(false);
  const originalTitleRef = useRef('');

  // Build PDF filename from request data
  const buildPdfTitle = useCallback((request: DbRequest, mode: 'invoice' | 'do') => {
    const clientProfile = clients.find(c => c.email === request.user_email);
    const clientName = (clientProfile?.name || request.user_email || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const docNo = request.id.slice(0, 6).toUpperCase();
    const now = new Date(request.created_at);
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;

    if (mode === 'invoice') {
      return `Invoice - ${clientName} - INV-${docNo} - ${dateStr}`;
    }
    return `DO - ${clientName} - DO-${docNo} - ${dateStr}`;
  }, [clients]);

  // Auto-trigger print after render
  useEffect(() => {
    if (printRequest && printTriggerRef.current) {
      const timer = setTimeout(() => {
        window.print();
        printTriggerRef.current = false;
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [printRequest, printMode]);

  const handlePrintInvoice = useCallback((request: DbRequest) => {
    originalTitleRef.current = document.title;
    document.title = buildPdfTitle(request, 'invoice');
    setPrintMode('invoice');
    setPrintRequest(request);
    printTriggerRef.current = true;
  }, [buildPdfTitle]);

  const handlePrintDO = useCallback((request: DbRequest) => {
    originalTitleRef.current = document.title;
    document.title = buildPdfTitle(request, 'do');
    setPrintMode('do');
    setPrintRequest(request);
    printTriggerRef.current = true;
  }, [buildPdfTitle]);

  const handleClosePrint = useCallback(() => {
    setPrintRequest(null);
    document.title = originalTitleRef.current || 'SMS Laboratory Systems';
  }, []);

  const fetching = !requests.length && !invoices.length && !closings.length && !errorReq && !errorInv;
  const error = errorReq || errorInv || errorClose;

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshRequests(),
      refreshInvoices(),
      refreshClosings(),
      refreshFakturTasks()
    ]);
  }, [refreshRequests, refreshInvoices, refreshClosings, refreshFakturTasks]);

  // ---------- Realtime subscriptions ----------
  useRealtimeTable('requests', undefined, () => { refreshRequests(); }, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('invoices', undefined, () => { refreshInvoices(); }, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('monthly_closing', undefined, () => { refreshClosings(); }, {
    enabled: Boolean(profile),
    debounceMs: 300,
  });

  useRealtimeTable('faktur_tasks', undefined, () => { refreshFakturTasks(); }, {
    enabled: Boolean(profile),
    debounceMs: 300,
  });

  // ---------- Computed values ----------
  const approved = useMemo(
    () => requests.filter((r) => r.status === 'approved'),
    [requests]
  );

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid');
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    const paidTotal = paid.reduce((sum, i) => sum + i.total, 0);

    const now = new Date();
    const monthlyRevenue = invoices
      .filter((i) => {
        const d = new Date(i.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, i) => sum + i.total, 0);

    return {
      needsInvoice: approved.length,
      invoiceReady: requests.filter((r) => r.status === 'invoice_ready').length,
      unpaidCount: unpaid.length,
      monthlyRevenue,
      paidTotal,
    };
  }, [requests, invoices, approved]);

  // ---------- Handlers ----------
  const handleGenerateInvoice = useCallback(
    async (request: DbRequest) => {
      if (!profile) return;
      setProcessingId(request.id);
      try {
        await workflowEngine.transition({
          request,
          actorId: profile.id,
          actorEmail: profile.email,
          actorRole: role,
          nextStatus: 'invoice_ready',
          action: 'generate_invoice',
          message: `Invoice generated for order ${formatOrderId(request.id)}`,
          type: 'info',
          notifyRoles: ['warehouse'],
        });
        await refreshAll();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Invoice generation failed');
      } finally {
        setProcessingId(null);
      }
    },
    [profile, role, refreshAll]
  );

  const handleMarkPaid = useCallback(
    async () => {
      if (!profile || !paymentModal) return;
      setProcessingId(paymentModal.id);
      try {
        await financeService.markInvoicePaid(
          paymentModal.id,
          paymentMethod || 'transfer',
          paymentRef || '-',
          { id: profile.id, email: profile.email, role }
        );
        setPaymentModal(null);
        setPaymentMethod('');
        setPaymentRef('');
        await refreshAll();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to mark invoice paid');
      } finally {
        setProcessingId(null);
      }
    },
    [profile, role, paymentModal, paymentMethod, paymentRef, refreshAll]
  );

  const handleMonthlyClosing = useCallback(async () => {
    if (!profile) return;
    setProcessingId('monthly-close');
    try {
      const now = new Date();
      await financeService.runMonthlyClosing(
        now.getMonth() + 1,
        now.getFullYear(),
        activeBranchId,
        { id: profile.id, email: profile.email, role }
      );
      setClosingNotes('');
      await refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to close month');
    } finally {
      setProcessingId(null);
    }
  }, [profile, role, closingNotes, refreshAll]);

  // ---------- Render: loading ----------
  if (loading || fetching) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  // ---------- Render: error ----------
  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <ErrorState message={error} onRetry={refreshAll} />
      </div>
    );
  }

  // ---------- Render: main ----------
  return (
    <>
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Finance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Invoice management, payments, and monthly closing.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Needs Invoice" value={stats.needsInvoice} color="yellow" />
        <StatCard label="Invoice Ready" value={stats.invoiceReady} color="blue" />
        <StatCard label="Unpaid Invoices" value={stats.unpaidCount} color="red" />
        <StatCard label="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} color="green" />
        <StatCard label="Paid Revenue" value={formatCurrency(stats.paidTotal)} color="green" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([
          { key: 'queue' as TabKey, label: 'Invoice Queue' },
          { key: 'invoices' as TabKey, label: 'Invoices' },
          { key: 'faktur_dispatch' as TabKey, label: 'Faktur Dispatch' },
          { key: 'closing' as TabKey, label: 'Monthly Closing' },
        ]).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
              tab === item.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab: Invoice Queue */}
      {tab === 'queue' && (
        <section className="space-y-4">
          {approved.length === 0 ? (
            <EmptyState
              title="No requests in queue"
              description="No approved requests are waiting for invoicing."
            />
          ) : (
            approved.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.user_email || formatOrderId(request.id)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={request.status} />
                    {request.branch && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {request.branch.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4 space-y-1 text-sm text-gray-500">
                  {(request.request_items ?? []).map((item, idx) => (
                    <p key={`${request.id}-item-${idx}`}>
                      {item.products?.name || item.product_id} x{item.quantity}
                    </p>
                  ))}
                </div>

                <div className="mb-4">
                  <OrderNotes
                    requestId={request.id}
                    allowedTargetRoles={['boss', 'warehouse', 'client']}
                    compact
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {request.total_price ? formatCurrency(request.total_price) : 'Price not set'}
                    </p>
                    {(request.discount_amount ?? 0) > 0 && (
                      <p className="text-xs text-green-600 font-medium">
                        Discount: -{formatCurrency(request.discount_amount ?? 0)}
                        {request.discount_type === 'percent' && ` (${request.discount_value}%)`}
                        {request.discount_reason && ` — ${request.discount_reason}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePrintInvoice(request)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print Invoice
                      </span>
                    </button>
                    <button
                      onClick={() => handlePrintDO(request)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Print DO
                      </span>
                    </button>
                    <button
                      onClick={() => handleGenerateInvoice(request)}
                      disabled={processingId === request.id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processingId === request.id ? 'Generating...' : 'Generate Invoice'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Tab: Invoices */}
      {tab === 'invoices' && (
        <section className="space-y-3">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" description="No invoices have been created yet." />
          ) : (
            invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{invoice.invoice_number}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDate(invoice.created_at)}
                    {invoice.due_date && <> &middot; Due: {formatDate(invoice.due_date)}</>}
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatCurrency(invoice.total)}
                    <span className="ml-1 text-xs text-gray-500">
                      {(invoice.discount_amount ?? 0) > 0 && (
                        <>disc -{formatCurrency(invoice.discount_amount ?? 0)} &middot; </>
                      )}
                      +{formatCurrency(invoice.tax_amount)} tax
                    </span>
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  {invoice.status === 'paid' ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      PAID
                    </span>
                  ) : (
                    <button
                      onClick={() => setPaymentModal(invoice)}
                      disabled={processingId === invoice.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
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

      {tab === 'faktur_dispatch' && (
        <FakturDispatchTab 
          tasks={fakturTasks} 
          fakturUsers={fakturUsers} 
          clients={clients} 
          profile={profile!} 
          onRefresh={refreshAll} 
        />
      )}

      {/* Tab: Monthly Closing */}
      {tab === 'closing' && (
        <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* Close form */}
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Close Current Month</h2>
              <p className="mt-1 text-sm text-gray-500">
                Snapshot finance totals from invoices into the monthly closing table.
              </p>
            </div>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Notes for this closing..."
            />
            <button
              onClick={handleMonthlyClosing}
              disabled={processingId === 'monthly-close'}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {processingId === 'monthly-close' ? 'Closing...' : 'Run Monthly Closing'}
            </button>
          </div>

          {/* History */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Closing History</h2>
            <div className="space-y-3">
              {closings.length === 0 ? (
                <p className="text-sm text-gray-500">No monthly closings yet.</p>
              ) : (
                closings.map((closing) => (
                  <div
                    key={closing.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {String(closing.month).padStart(2, '0')}/{closing.year}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Revenue {formatCurrency(closing.total_revenue)} &middot; Orders{' '}
                      {closing.orders_count}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Paid {closing.paid_invoices} &middot; Unpaid {closing.unpaid_invoices}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Payment Modal */}
      <Modal
        isOpen={Boolean(paymentModal)}
        onClose={() => setPaymentModal(null)}
        title="Mark Invoice as Paid"
        size="sm"
      >
        {paymentModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{paymentModal.invoice_number}</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                {formatCurrency(paymentModal.total)}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Select method...</option>
                <option value="transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
                Payment Reference
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Transaction ID or reference..."
              />
            </div>

            <button
              onClick={handleMarkPaid}
              disabled={processingId === paymentModal.id}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {processingId === paymentModal.id ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        )}
      </Modal>
    </div>

      {/* ===== Print Overlay ===== */}
      {printRequest && (
        <div className="print-overlay fixed inset-0 z-[9999] bg-gray-400 overflow-auto">
          {/* Toolbar - hidden during print */}
          <div className="no-print sticky top-0 z-10 flex items-center justify-between bg-gray-900 px-6 py-3 shadow-lg">
            <p className="text-white text-sm font-semibold">
              🖨️ Print Preview — {printMode === 'invoice' ? 'Sales Invoice' : 'Delivery Order'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                🖨️ Print / Download PDF
              </button>
              <button
                onClick={() => handleClosePrint()}
                className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Single document based on printMode */}
          <div className="print-page print-preview-page">
            {printMode === 'invoice' ? (
              <SalesInvoicePrint
                request={printRequest}
                client={clients.find(c => c.email === printRequest.user_email)}
              />
            ) : (
              <DeliveryOrderPrint
                request={printRequest}
                client={clients.find(c => c.email === printRequest.user_email)}
              />
            )}
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Reset page */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide ALL elements by default */
          body * {
            visibility: hidden !important;
          }

          /* Show print overlay and ALL its children */
          .print-overlay,
          .print-overlay * {
            visibility: visible !important;
          }

          /* But hide the toolbar inside print overlay */
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          /* Position print overlay to fill the page */
          .print-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            background: white !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }

          /* Each print-page = one A4 page */
          .print-page {
            page-break-after: always;
            break-after: page;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .print-page:last-child {
            page-break-after: avoid;
          }

          /* Zero margin — documents have their own internal padding */
          @page {
            size: A4;
            margin: 0;
          }
        }

        /* Screen preview styling */
        .print-preview-page {
          width: 210mm;
          min-height: 297mm;
          margin: 10mm auto;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
          background: white;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}
