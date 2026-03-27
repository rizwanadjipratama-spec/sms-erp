'use client';

import { useState } from 'react';
import Link from 'next/link';
import { downloadCsvExport, exportCustomerReportCsv, exportDeliveryReportCsv, exportInventoryReportCsv, exportInvoiceReportCsv, exportSalesReportCsv } from '@/lib/export-service';
import { pdfService } from '@/lib/pdf-service';
import { getCustomerReport, getDeliveryReport, getInventoryReport, getInvoiceReport, getSalesReport } from '@/lib/report-service';

type ReportState = {
  sales: Awaited<ReturnType<typeof getSalesReport>> | null;
  inventory: Awaited<ReturnType<typeof getInventoryReport>> | null;
  delivery: Awaited<ReturnType<typeof getDeliveryReport>> | null;
  invoice: Awaited<ReturnType<typeof getInvoiceReport>> | null;
  customer: Awaited<ReturnType<typeof getCustomerReport>> | null;
};

export default function OwnerReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportState>({
    sales: null,
    inventory: null,
    delivery: null,
    invoice: null,
    customer: null,
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const [sales, inventory, delivery, invoice, customer] = await Promise.all([
        getSalesReport(startDate, endDate),
        getInventoryReport(startDate, endDate),
        getDeliveryReport(startDate, endDate),
        getInvoiceReport(startDate, endDate),
        getCustomerReport(startDate, endDate),
      ]);

      setReports({ sales, inventory, delivery, invoice, customer });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const runExport = async (key: string, handler: () => Promise<void>) => {
    setExporting(key);
    try {
      await handler();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Owner Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Structured reporting across sales, inventory, delivery, invoices, and customers.</p>
        </div>
        <Link
          href="/dashboard/owner"
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <div className="grid md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="text-gray-500 text-sm">to</div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={loadReports}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Reports'}
          </button>
        </div>
      </div>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Export Center</h2>
          <p className="text-sm text-gray-500 mt-1">CSV exports are Excel-compatible. PDF reports are generated and stored in the documents bucket.</p>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          <button
            onClick={() => runExport('sales-csv', async () => downloadCsvExport(await exportSalesReportCsv(startDate, endDate)))}
            disabled={!!exporting}
            className="px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {exporting === 'sales-csv' ? 'Exporting...' : 'Export Sales CSV'}
          </button>
          <button
            onClick={() => runExport('inventory-csv', async () => downloadCsvExport(await exportInventoryReportCsv(startDate, endDate)))}
            disabled={!!exporting}
            className="px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {exporting === 'inventory-csv' ? 'Exporting...' : 'Export Inventory CSV'}
          </button>
          <button
            onClick={() => runExport('delivery-csv', async () => downloadCsvExport(await exportDeliveryReportCsv(startDate, endDate)))}
            disabled={!!exporting}
            className="px-4 py-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {exporting === 'delivery-csv' ? 'Exporting...' : 'Export Delivery CSV'}
          </button>
          <button
            onClick={() => runExport('invoice-csv', async () => downloadCsvExport(await exportInvoiceReportCsv(startDate, endDate)))}
            disabled={!!exporting}
            className="px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {exporting === 'invoice-csv' ? 'Exporting...' : 'Export Invoice CSV'}
          </button>
          <button
            onClick={() => runExport('customer-csv', async () => downloadCsvExport(await exportCustomerReportCsv(startDate, endDate)))}
            disabled={!!exporting}
            className="px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {exporting === 'customer-csv' ? 'Exporting...' : 'Export Customer CSV'}
          </button>
          <button
            onClick={() =>
              runExport('sales-pdf', async () => {
                const sales = await getSalesReport(startDate, endDate);
                const label = `${startDate}_${endDate}`;
                const document = await pdfService.generateSalesReportPdf({
                  label,
                  summary: sales,
                });
                if (document.signedUrl) {
                  window.open(document.signedUrl, '_blank', 'noopener,noreferrer');
                } else {
                  alert(`PDF stored at ${document.path}`);
                }
              })
            }
            disabled={!!exporting}
            className="px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {exporting === 'sales-pdf' ? 'Generating...' : 'Generate Sales PDF'}
          </button>
        </div>
      </section>

      {reports.sales && (
        <div className="grid xl:grid-cols-2 gap-5">
          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Sales Report</h2>
            <p className="text-sm text-gray-500">Total sales Rp{reports.sales.totalSales.toLocaleString('id-ID')}</p>
            <p className="text-sm text-gray-500">Paid sales Rp{reports.sales.paidSales.toLocaleString('id-ID')}</p>
            <p className="text-sm text-gray-500">Unpaid sales Rp{reports.sales.unpaidSales.toLocaleString('id-ID')}</p>
            <p className="text-sm text-gray-500">Invoices {reports.sales.invoicesCount}</p>
          </section>

          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Inventory Report</h2>
            <p className="text-sm text-gray-500">Inbound {reports.inventory?.inbound.toLocaleString('id-ID')}</p>
            <p className="text-sm text-gray-500">Outbound {reports.inventory?.outbound.toLocaleString('id-ID')}</p>
            <p className="text-sm text-gray-500">Adjustments {reports.inventory?.adjustments}</p>
            <p className="text-sm text-gray-500">Logs {reports.inventory?.logs.length}</p>
          </section>

          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Delivery Report</h2>
            <p className="text-sm text-gray-500">Delivered {reports.delivery?.deliveredCount}</p>
            <p className="text-sm text-gray-500">With proof {reports.delivery?.withProof}</p>
            <p className="text-sm text-gray-500">Technicians active {reports.delivery?.technicians}</p>
          </section>

          <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Invoice Report</h2>
            <p className="text-sm text-gray-500">Paid invoices {reports.invoice?.paidInvoices}</p>
            <p className="text-sm text-gray-500">Unpaid invoices {reports.invoice?.unpaidInvoices}</p>
            <p className="text-sm text-gray-500">Total invoices {reports.invoice?.invoicesCount}</p>
          </section>
        </div>
      )}

      {reports.customer && (
        <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Report</h2>
          <div className="space-y-3">
            {reports.customer.customers.map((customer) => (
              <div key={customer.userId} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{customer.userEmail}</p>
                  <p className="text-xs text-gray-500">{customer.invoices} invoice(s)</p>
                </div>
                <p className="text-sm font-semibold text-emerald-400">
                  Rp{customer.total.toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
