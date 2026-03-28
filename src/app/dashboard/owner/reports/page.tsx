'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/lib/services';
import { formatCurrency, formatNumber } from '@/lib/format-utils';
import { PageSpinner, EmptyState, ErrorState, StatCard } from '@/components/ui';
import {
  downloadCsvExport,
  exportSalesReportCsv,
  exportInventoryReportCsv,
  exportDeliveryReportCsv,
  exportInvoiceReportCsv,
  exportCustomerReportCsv,
} from '@/lib/export-service';
import { pdfService } from '@/lib/pdf-service';
import { getSalesReport, getInventoryReport, getDeliveryReport, getInvoiceReport, getCustomerReport } from '@/lib/report-service';

type ReportState = {
  sales: Awaited<ReturnType<typeof getSalesReport>> | null;
  inventory: Awaited<ReturnType<typeof getInventoryReport>> | null;
  delivery: Awaited<ReturnType<typeof getDeliveryReport>> | null;
  invoice: Awaited<ReturnType<typeof getInvoiceReport>> | null;
  customer: Awaited<ReturnType<typeof getCustomerReport>> | null;
};

type MonthlyRevenueRow = {
  month: string;
  invoice_count: number;
  total_revenue: number;
  total_tax: number;
  paid_count: number;
  unpaid_count: number;
};

type ProductPerformanceRow = {
  id: string;
  name: string;
  category: string;
  stock: number;
  total_ordered: number;
  total_revenue: number;
  order_count: number;
};

export default function OwnerReportsPage() {
  const { profile, loading: authLoading } = useAuth();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStart = useMemo(() => `${today.slice(0, 8)}01`, [today]);

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const [reports, setReports] = useState<ReportState>({
    sales: null,
    inventory: null,
    delivery: null,
    invoice: null,
    customer: null,
  });

  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenueRow[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformanceRow[]>([]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sales, inventory, delivery, invoice, customer, monthly, products] = await Promise.all([
        getSalesReport(startDate, endDate),
        getInventoryReport(startDate, endDate),
        getDeliveryReport(startDate, endDate),
        getInvoiceReport(startDate, endDate),
        getCustomerReport(startDate, endDate),
        analyticsService.getMonthlyRevenue(),
        analyticsService.getProductPerformance(20),
      ]);

      setReports({ sales, inventory, delivery, invoice, customer });
      setMonthlyRevenue(monthly);
      setProductPerformance(products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const runExport = useCallback(async (key: string, handler: () => Promise<void>) => {
    setExporting(key);
    try {
      await handler();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  }, []);

  const handlePdfExport = useCallback(async () => {
    const sales = await getSalesReport(startDate, endDate);
    const label = `${startDate}_${endDate}`;
    const document = await pdfService.generateSalesReportPdf({ label, summary: sales });
    if (document.signedUrl) {
      window.open(document.signedUrl, '_blank', 'noopener,noreferrer');
    }
  }, [startDate, endDate]);

  const hasReports = reports.sales !== null;

  const totalRevenueFromMonthly = useMemo(() => {
    return monthlyRevenue.reduce((sum, r) => sum + r.total_revenue, 0);
  }, [monthlyRevenue]);

  if (authLoading) return <PageSpinner />;

  const exportButtons = [
    { key: 'sales-csv', label: 'Sales CSV', color: 'bg-emerald-600 hover:bg-emerald-700', handler: async () => downloadCsvExport(await exportSalesReportCsv(startDate, endDate)) },
    { key: 'inventory-csv', label: 'Inventory CSV', color: 'bg-cyan-600 hover:bg-cyan-700', handler: async () => downloadCsvExport(await exportInventoryReportCsv(startDate, endDate)) },
    { key: 'delivery-csv', label: 'Delivery CSV', color: 'bg-sky-600 hover:bg-sky-700', handler: async () => downloadCsvExport(await exportDeliveryReportCsv(startDate, endDate)) },
    { key: 'invoice-csv', label: 'Invoice CSV', color: 'bg-indigo-600 hover:bg-indigo-700', handler: async () => downloadCsvExport(await exportInvoiceReportCsv(startDate, endDate)) },
    { key: 'customer-csv', label: 'Customer CSV', color: 'bg-violet-600 hover:bg-violet-700', handler: async () => downloadCsvExport(await exportCustomerReportCsv(startDate, endDate)) },
    { key: 'sales-pdf', label: 'Sales PDF', color: 'bg-amber-600 hover:bg-amber-700', handler: handlePdfExport },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Owner Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Structured reporting across sales, inventory, delivery, invoices, and customers.
          </p>
        </div>
        <Link
          href="/dashboard/owner"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div className="hidden text-sm text-gray-400 md:block">to</div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
            />
          </div>
          <button
            onClick={loadReports}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Reports'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <ErrorState message={error} onRetry={loadReports} />
      )}

      {/* Export Center */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Export Center</h2>
          <p className="mt-1 text-xs text-gray-500">CSV exports are Excel-compatible. PDF reports are stored in the documents bucket.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {exportButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => runExport(btn.key, btn.handler)}
              disabled={!!exporting}
              className={`rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 ${btn.color}`}
            >
              {exporting === btn.key
                ? (btn.key.includes('pdf') ? 'Generating...' : 'Exporting...')
                : `Export ${btn.label}`
              }
            </button>
          ))}
        </div>
      </section>

      {/* Report Summary Cards */}
      {hasReports && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Sales"
            value={formatCurrency(reports.sales?.totalSales)}
            sub={`${reports.sales?.invoicesCount ?? 0} invoices`}
            color="green"
          />
          <StatCard
            label="Paid Sales"
            value={formatCurrency(reports.sales?.paidSales)}
            color="blue"
          />
          <StatCard
            label="Unpaid Sales"
            value={formatCurrency(reports.sales?.unpaidSales)}
            color={reports.sales?.unpaidSales ? 'red' : 'gray'}
          />
          <StatCard
            label="Deliveries"
            value={reports.delivery?.deliveredCount ?? 0}
            sub={`${reports.delivery?.withProof ?? 0} with proof`}
            color="purple"
          />
        </div>
      )}

      {/* Report Details Grid */}
      {hasReports && (
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Sales Report */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Sales Report</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Total Sales</span>
                <span className="font-medium text-gray-900">{formatCurrency(reports.sales?.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(reports.sales?.paidSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Unpaid</span>
                <span className="font-medium text-red-600">{formatCurrency(reports.sales?.unpaidSales)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span>Invoices</span>
                <span className="font-medium text-gray-900">{reports.sales?.invoicesCount}</span>
              </div>
            </div>
          </section>

          {/* Inventory Report */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Inventory Report</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Inbound</span>
                <span className="font-medium text-green-600">+{formatNumber(reports.inventory?.inbound)}</span>
              </div>
              <div className="flex justify-between">
                <span>Outbound</span>
                <span className="font-medium text-red-600">-{formatNumber(reports.inventory?.outbound)}</span>
              </div>
              <div className="flex justify-between">
                <span>Adjustments</span>
                <span className="font-medium text-gray-900">{reports.inventory?.adjustments}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span>Log Entries</span>
                <span className="font-medium text-gray-900">{reports.inventory?.logs.length}</span>
              </div>
            </div>
          </section>

          {/* Delivery Report */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Delivery Report</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Delivered</span>
                <span className="font-medium text-gray-900">{reports.delivery?.deliveredCount}</span>
              </div>
              <div className="flex justify-between">
                <span>With Proof</span>
                <span className="font-medium text-gray-900">{reports.delivery?.withProof}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span>Active Technicians</span>
                <span className="font-medium text-gray-900">{reports.delivery?.technicians}</span>
              </div>
            </div>
          </section>

          {/* Invoice Report */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Invoice Report</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Paid Invoices</span>
                <span className="font-medium text-green-600">{reports.invoice?.paidInvoices}</span>
              </div>
              <div className="flex justify-between">
                <span>Unpaid Invoices</span>
                <span className="font-medium text-red-600">{reports.invoice?.unpaidInvoices}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span>Total Invoices</span>
                <span className="font-medium text-gray-900">{reports.invoice?.invoicesCount}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Monthly Revenue Table */}
      {monthlyRevenue.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Monthly Revenue</h2>
            <p className="mt-1 text-xs text-gray-500">
              Last {monthlyRevenue.length} months — Total: {formatCurrency(totalRevenueFromMonthly)}
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Month</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Invoices</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Tax</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Paid</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Unpaid</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRevenue.map((row, idx) => (
                  <tr key={row.month} className={`border-b border-gray-50 ${idx === 0 ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{row.month}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.invoice_count}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(row.total_revenue)}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{formatCurrency(row.total_tax)}</td>
                    <td className="px-5 py-3 text-right text-green-600">{row.paid_count}</td>
                    <td className="px-5 py-3 text-right text-red-600">{row.unpaid_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-gray-50 sm:hidden">
            {monthlyRevenue.map(row => (
              <div key={row.month} className="p-4">
                <p className="text-sm font-medium text-gray-900">{row.month}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <span>Revenue: <strong className="text-gray-900">{formatCurrency(row.total_revenue)}</strong></span>
                  <span>Invoices: <strong className="text-gray-900">{row.invoice_count}</strong></span>
                  <span>Paid: <strong className="text-green-600">{row.paid_count}</strong></span>
                  <span>Unpaid: <strong className="text-red-600">{row.unpaid_count}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product Performance Table */}
      {productPerformance.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Product Performance</h2>
            <p className="mt-1 text-xs text-gray-500">Top {productPerformance.length} products by revenue</p>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">#</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Ordered</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Orders</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {productPerformance.map((row, idx) => (
                  <tr key={row.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {row.category || '-'}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-right ${row.stock <= 5 ? 'font-medium text-red-600' : 'text-gray-700'}`}>
                      {formatNumber(row.stock)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatNumber(row.total_ordered)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.order_count}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(row.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-gray-50 sm:hidden">
            {productPerformance.map((row, idx) => (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      <span className="mr-1 text-xs text-gray-400">#{idx + 1}</span>
                      {row.name}
                    </p>
                    {row.category && (
                      <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {row.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.total_revenue)}</p>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>Stock: {formatNumber(row.stock)}</span>
                  <span>Ordered: {formatNumber(row.total_ordered)}</span>
                  <span>Orders: {row.order_count}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Customer Report */}
      {reports.customer && reports.customer.customers.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Customer Report</h2>
            <p className="mt-1 text-xs text-gray-500">{reports.customer.customers.length} customers in period</p>
          </div>
          <div className="divide-y divide-gray-50">
            {reports.customer.customers.map(customer => (
              <div key={customer.userId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{customer.userEmail}</p>
                  <p className="text-xs text-gray-500">{customer.invoices} invoice{customer.invoices !== 1 ? 's' : ''}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-600">
                  {formatCurrency(customer.total)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when no reports loaded yet */}
      {!hasReports && !loading && !error && (
        <EmptyState
          title="No reports loaded"
          description="Select a date range above and click Load Reports to view data."
        />
      )}
    </div>
  );
}
