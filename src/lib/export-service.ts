import {
  getCustomerReport,
  getDeliveryReport,
  getInventoryReport,
  getInvoiceReport,
  getSalesReport,
} from './report-service';
import { handleServiceError, logServiceExecution, withOperationLock } from './service-utils';

type CsvExport = {
  fileName: string;
  content: string;
  mimeType: string;
};

function csvEscape(value: unknown) {
  const normalized =
    value === null || value === undefined
      ? ''
      : Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

function makeFileName(prefix: string, startDate: string, endDate: string) {
  return `${prefix}-${startDate || 'start'}-${endDate || 'end'}.csv`;
}

export function downloadCsvExport(file: CsvExport) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportSalesReportCsv(startDate: string, endDate: string): Promise<CsvExport> {
  return withOperationLock(`export:sales:${startDate}:${endDate}`, async () => {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'export-service',
      action: 'exportSalesReportCsv',
      stage: 'start',
      startedAt,
      metadata: { startDate, endDate },
    });
    try {
      const report = await getSalesReport(startDate, endDate);
      const result = {
        fileName: makeFileName('sales-report', startDate, endDate),
        mimeType: 'text/csv;charset=utf-8',
        content: buildCsv(
          ['Invoice Number', 'Order ID', 'Amount', 'Paid', 'Created At'],
          report.invoices.map((invoice) => [
            invoice.invoice_number,
            invoice.order_id,
            invoice.amount,
            invoice.paid ? 'Yes' : 'No',
            invoice.created_at,
          ])
        ),
      };
      await logServiceExecution({
        service: 'export-service',
        action: 'exportSalesReportCsv',
        stage: 'success',
        startedAt,
        metadata: {
          startDate,
          endDate,
          rows: report.invoices.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'export-service',
        action: 'exportSalesReportCsv',
        stage: 'failure',
        startedAt,
        metadata: { startDate, endDate },
      });
      throw handleServiceError('export-service', 'exportSalesReportCsv', error, { startDate, endDate });
    }
  });
}

export async function exportInventoryReportCsv(startDate: string, endDate: string): Promise<CsvExport> {
  return withOperationLock(`export:inventory:${startDate}:${endDate}`, async () => {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'export-service',
      action: 'exportInventoryReportCsv',
      stage: 'start',
      startedAt,
      metadata: { startDate, endDate },
    });
    try {
      const report = await getInventoryReport(startDate, endDate);
      const result = {
        fileName: makeFileName('inventory-report', startDate, endDate),
        mimeType: 'text/csv;charset=utf-8',
        content: buildCsv(
          ['Product ID', 'Order ID', 'Change', 'Reason', 'By User', 'Created At'],
          report.logs.map((log) => [log.product_id, log.order_id || '', log.change, log.reason, log.by_user || '', log.created_at])
        ),
      };
      await logServiceExecution({
        service: 'export-service',
        action: 'exportInventoryReportCsv',
        stage: 'success',
        startedAt,
        metadata: {
          startDate,
          endDate,
          rows: report.logs.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'export-service',
        action: 'exportInventoryReportCsv',
        stage: 'failure',
        startedAt,
        metadata: { startDate, endDate },
      });
      throw handleServiceError('export-service', 'exportInventoryReportCsv', error, { startDate, endDate });
    }
  });
}

export async function exportDeliveryReportCsv(startDate: string, endDate: string): Promise<CsvExport> {
  return withOperationLock(`export:delivery:${startDate}:${endDate}`, async () => {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'export-service',
      action: 'exportDeliveryReportCsv',
      stage: 'start',
      startedAt,
      metadata: { startDate, endDate },
    });
    try {
      const report = await getDeliveryReport(startDate, endDate);
      const result = {
        fileName: makeFileName('delivery-report', startDate, endDate),
        mimeType: 'text/csv;charset=utf-8',
        content: buildCsv(
          ['Order ID', 'Technician ID', 'Delivered At', 'Proof URL', 'Signature URL', 'Note'],
          report.logs.map((log) => [
            log.order_id,
            log.technician_id,
            log.delivered_at || '',
            log.proof_url || '',
            log.signature_url || '',
            log.note || '',
          ])
        ),
      };
      await logServiceExecution({
        service: 'export-service',
        action: 'exportDeliveryReportCsv',
        stage: 'success',
        startedAt,
        metadata: {
          startDate,
          endDate,
          rows: report.logs.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'export-service',
        action: 'exportDeliveryReportCsv',
        stage: 'failure',
        startedAt,
        metadata: { startDate, endDate },
      });
      throw handleServiceError('export-service', 'exportDeliveryReportCsv', error, { startDate, endDate });
    }
  });
}

export async function exportInvoiceReportCsv(startDate: string, endDate: string): Promise<CsvExport> {
  return withOperationLock(`export:invoice:${startDate}:${endDate}`, async () => {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'export-service',
      action: 'exportInvoiceReportCsv',
      stage: 'start',
      startedAt,
      metadata: { startDate, endDate },
    });
    try {
      const report = await getInvoiceReport(startDate, endDate);
      const result = {
        fileName: makeFileName('invoice-report', startDate, endDate),
        mimeType: 'text/csv;charset=utf-8',
        content: buildCsv(
          ['Invoice Number', 'Order ID', 'Amount', 'Paid', 'Created At'],
          report.invoices.map((invoice) => [
            invoice.invoice_number,
            invoice.order_id,
            invoice.amount,
            invoice.paid ? 'Yes' : 'No',
            invoice.created_at,
          ])
        ),
      };
      await logServiceExecution({
        service: 'export-service',
        action: 'exportInvoiceReportCsv',
        stage: 'success',
        startedAt,
        metadata: {
          startDate,
          endDate,
          rows: report.invoices.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'export-service',
        action: 'exportInvoiceReportCsv',
        stage: 'failure',
        startedAt,
        metadata: { startDate, endDate },
      });
      throw handleServiceError('export-service', 'exportInvoiceReportCsv', error, { startDate, endDate });
    }
  });
}

export async function exportCustomerReportCsv(startDate: string, endDate: string): Promise<CsvExport> {
  return withOperationLock(`export:customer:${startDate}:${endDate}`, async () => {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'export-service',
      action: 'exportCustomerReportCsv',
      stage: 'start',
      startedAt,
      metadata: { startDate, endDate },
    });
    try {
      const report = await getCustomerReport(startDate, endDate);
      const result = {
        fileName: makeFileName('customer-report', startDate, endDate),
        mimeType: 'text/csv;charset=utf-8',
        content: buildCsv(
          ['User ID', 'Email', 'Total Spending', 'Invoices'],
          report.customers.map((customer) => [customer.userId, customer.userEmail, customer.total, customer.invoices])
        ),
      };
      await logServiceExecution({
        service: 'export-service',
        action: 'exportCustomerReportCsv',
        stage: 'success',
        startedAt,
        metadata: {
          startDate,
          endDate,
          rows: report.customers.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'export-service',
        action: 'exportCustomerReportCsv',
        stage: 'failure',
        startedAt,
        metadata: { startDate, endDate },
      });
      throw handleServiceError('export-service', 'exportCustomerReportCsv', error, { startDate, endDate });
    }
  });
}
