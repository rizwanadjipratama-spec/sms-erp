'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { invoicesDb, monthlyClosingDb } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/format-utils';
import { StatCard, DashboardSkeleton, EmptyState, ErrorState } from '@/components/ui';
import type { Invoice, MonthlyClosing } from '@/types/types';

export default function TaxDashboard() {
  const { profile, loading } = useAuth();
  
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activeTab, setActiveTab] = useState<'invoices' | 'closings'>('invoices');

  const { data: invoiceData = [], mutate: refreshInvoices, error: errorInv } = useSWR(
    profile?.id ? ['tax_invoices'] : null,
    async () => {
      const res = await invoicesDb.getAll();
      return res.data;
    }
  );

  const { data: closings = [], mutate: refreshClosings, error: errorClose } = useSWR(
    profile?.id ? ['tax_closings'] : null,
    () => monthlyClosingDb.getAll()
  );

  const invoices = invoiceData;
  const fetching = !invoices.length && !closings.length && !errorInv && !errorClose;
  const errorObj = errorInv || errorClose;
  const error = errorObj ? (errorObj.message || String(errorObj)) : null;

  useRealtimeTable('invoices', undefined, () => { refreshInvoices(); }, {
    enabled: Boolean(profile?.id),
    debounceMs: 500,
  });

  useRealtimeTable('monthly_closing', undefined, () => { refreshClosings(); }, {
    enabled: Boolean(profile?.id),
    debounceMs: 500,
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (from && inv.created_at < from) return false;
      if (to && inv.created_at > `${to}T23:59:59`) return false;
      return true;
    });
  }, [invoices, from, to]);

  const stats = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalTax = filteredInvoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const paidInvoices = filteredInvoices.filter((inv) => inv.status === 'paid');
    const paidRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const unpaidCount = filteredInvoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled').length;
    return { totalRevenue, totalTax, paidRevenue, paidCount: paidInvoices.length, unpaidCount };
  }, [filteredInvoices]);

  const handleClearFilter = useCallback(() => {
    setFrom('');
    setTo('');
  }, []);

  if (loading || fetching) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => { refreshInvoices(); refreshClosings(); }} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Tax & Sales Reports
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Invoice-based tax reporting and monthly closings.
        </p>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <span className="text-sm font-medium lowercase text-gray-500">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <button
          onClick={handleClearFilter}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Sales"
          value={formatCurrency(stats.totalRevenue)}
          sub={`${filteredInvoices.length} invoices`}
          color="blue"
        />
        <StatCard
          label="Tax Collected (11%)"
          value={formatCurrency(stats.totalTax)}
          sub={`${stats.paidCount} paid, ${stats.unpaidCount} unpaid`}
          color="purple"
        />
        <StatCard
          label="Paid Revenue"
          value={formatCurrency(stats.paidRevenue)}
          sub={`${stats.paidCount} invoices paid`}
          color="green"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Invoices ({filteredInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab('closings')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'closings'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Monthly Closings ({closings.length})
        </button>
      </div>

      {/* Invoices Table */}
      {activeTab === 'invoices' && (
        <section>
          {filteredInvoices.length === 0 ? (
            <EmptyState title="No invoices found" description="Adjust the date filter or wait for new invoices." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Invoice No.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Tax
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
                        {formatCurrency(invoice.tax_amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : invoice.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}
                        >
                          {invoice.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-right text-xs text-gray-500 sm:table-cell">
                        {formatDate(invoice.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Monthly Closings Table */}
      {activeTab === 'closings' && (
        <section>
          {closings.length === 0 ? (
            <EmptyState title="No monthly closings" description="Closings will appear here once finance completes month-end reporting." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Period
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Tax
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                      Orders
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                      Paid / Unpaid
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {closings.map((closing) => (
                    <tr
                      key={closing.id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {new Date(Number(closing.year), Number(closing.month) - 1).toLocaleDateString('id-ID', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(closing.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
                        {formatCurrency(closing.total_tax)}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-gray-500 sm:table-cell">
                        {closing.orders_count}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-xs md:table-cell">
                        <span className="text-green-600 dark:text-green-400">{closing.paid_invoices} paid</span>
                        {' / '}
                        <span className="text-amber-600 dark:text-amber-400">{closing.unpaid_invoices} unpaid</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
