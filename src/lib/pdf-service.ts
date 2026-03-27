import { logActivity } from './activity';
import { handleServiceError, logServiceExecution, withOperationLock } from './service-utils';
import { supabase } from './supabase';
import { formatCurrency } from './format-utils';
import type { DbRequest, DeliveryLog, DocumentFile, Invoice } from '@/types/types';
import { SYSTEM_USER_ID, SYSTEM_USER_EMAIL, MIME_TYPES } from './constants';

const DOCUMENT_BUCKET = 'documents';

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_/.]+/g, '-');
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines: string[]) {
  const safeLines = lines.filter(Boolean).slice(0, 120);
  const content = [
    'BT',
    '/F1 12 Tf',
    '48 792 Td',
    '16 TL',
    ...safeLines.flatMap((line, index) =>
      index === 0 ? [`(${escapePdfText(line)}) Tj`] : ['T*', `(${escapePdfText(line)}) Tj`]
    ),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj',
    `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

async function createSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 3600);
  if (error) {
    console.error('Document signed URL generation failed:', error.message);
    return null;
  }
  return data.signedUrl;
}


async function getMimeType(filename: string): Promise<string> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  switch (ext) {
    case '.pdf':
      return MIME_TYPES.PDF;
    case '.json':
      return MIME_TYPES.JSON;
    case '.csv':
      return MIME_TYPES.CSV;
    case '.png':
      return MIME_TYPES.PNG;
    case '.jpg':
    case '.jpeg':
      return MIME_TYPES.JPEG;
    default:
      return MIME_TYPES.TEXT;
  }
}

async function uploadDocumentFile(params: {
  folder: string;
  fileName: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<DocumentFile> {
  const path = `${sanitizeSegment(params.folder)}/${sanitizeSegment(params.fileName)}`;
  const mimeType = params.contentType || await getMimeType(params.fileName);

  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, params.bytes, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  await logActivity(SYSTEM_USER_ID, 'pdf_generated', 'document', path, {
    bucket: DOCUMENT_BUCKET,
    content_type: mimeType,
    file_name: params.fileName,
  });

  return {
    fileName: params.fileName,
    path,
    contentType: params.contentType || 'application/octet-stream',
    signedUrl: await createSignedUrl(path),
  };
}

function formatCurrencyLocal(value: number | undefined | null) {
  return formatCurrency(value);
}

export const pdfService = {
  async uploadTextPdf(params: { folder: string; fileName: string; lines: string[] }) {
    return withOperationLock(`pdf:${params.folder}:${params.fileName}`, async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'pdf-service',
        action: 'uploadTextPdf',
        stage: 'start',
        startedAt,
        metadata: {
          folder: params.folder,
          fileName: params.fileName,
          lines: params.lines.length,
        },
      });
      try {
        const document = await uploadDocumentFile({
          folder: params.folder,
          fileName: params.fileName,
          bytes: buildSimplePdf(params.lines),
          contentType: 'application/pdf',
        });
        await logServiceExecution({
          service: 'pdf-service',
          action: 'uploadTextPdf',
          stage: 'success',
          startedAt,
          metadata: {
            folder: params.folder,
            fileName: params.fileName,
            path: document.path,
          },
        });
        return document;
      } catch (error) {
        await logServiceExecution({
          service: 'pdf-service',
          action: 'uploadTextPdf',
          stage: 'failure',
          startedAt,
          metadata: {
            folder: params.folder,
            fileName: params.fileName,
          },
        });
        throw handleServiceError('pdf-service', 'uploadTextPdf', error, {
          folder: params.folder,
          fileName: params.fileName,
        });
      }
    });
  },

  async generateInvoicePdf(params: { invoice: Invoice; request?: DbRequest | null }) {
    const { invoice, request } = params;
    return this.uploadTextPdf({
      folder: 'invoices',
      fileName: `${invoice.invoice_number}.pdf`,
      lines: [
        `Invoice ${invoice.invoice_number}`,
        `Order ID: ${invoice.order_id}`,
        `Customer: ${request?.user_email || request?.user_id || 'Unknown'}`,
        `Status: ${request?.status || 'invoice_ready'}`,
        `Amount: ${formatCurrency(invoice.amount)}`,
        `Tax: ${formatCurrency(invoice.tax_amount)}`,
        `Due Date: ${invoice.due_date || '-'}`,
        `Paid: ${invoice.paid ? 'Yes' : 'No'}`,
        `Paid At: ${invoice.paid_at || '-'}`,
        `Notes: ${invoice.notes || '-'}`,
        `Created At: ${invoice.created_at}`,
      ],
    });
  },

  async generateDeliveryNotePdf(params: { deliveryLog: DeliveryLog; request?: DbRequest | null }) {
    const { deliveryLog, request } = params;
    return this.uploadTextPdf({
      folder: 'delivery-notes',
      fileName: `delivery-${deliveryLog.order_id}.pdf`,
      lines: [
        `Delivery Note`,
        `Order ID: ${deliveryLog.order_id}`,
        `Customer: ${request?.user_email || request?.user_id || 'Unknown'}`,
        `Technician ID: ${deliveryLog.technician_id}`,
        `Delivered At: ${deliveryLog.delivered_at || deliveryLog.created_at}`,
        `Proof URL: ${deliveryLog.proof_url || '-'}`,
        `Signature URL: ${deliveryLog.signature_url || '-'}`,
        `Note: ${deliveryLog.note || '-'}`,
      ],
    });
  },

  async generateMonthlyReportPdf(params: {
    monthLabel: string;
    summary: {
      totalSales: number;
      paidSales: number;
      unpaidSales: number;
      invoicesCount: number;
    };
  }) {
    return this.uploadTextPdf({
      folder: 'reports/monthly',
      fileName: `monthly-report-${params.monthLabel}.pdf`,
      lines: [
        `Monthly Report ${params.monthLabel}`,
        `Total Sales: ${formatCurrency(params.summary.totalSales)}`,
        `Paid Sales: ${formatCurrency(params.summary.paidSales)}`,
        `Unpaid Sales: ${formatCurrency(params.summary.unpaidSales)}`,
        `Invoices Count: ${params.summary.invoicesCount}`,
      ],
    });
  },

  async generateSalesReportPdf(params: {
    label: string;
    summary: {
      totalSales: number;
      paidSales: number;
      unpaidSales: number;
      invoicesCount: number;
    };
  }) {
    return this.uploadTextPdf({
      folder: 'reports/sales',
      fileName: `sales-report-${sanitizeSegment(params.label)}.pdf`,
      lines: [
        `Sales Report ${params.label}`,
        `Total Sales: ${formatCurrency(params.summary.totalSales)}`,
        `Paid Sales: ${formatCurrency(params.summary.paidSales)}`,
        `Unpaid Sales: ${formatCurrency(params.summary.unpaidSales)}`,
        `Invoices Count: ${params.summary.invoicesCount}`,
      ],
    });
  },
};
