'use client';

import React from 'react';
import { formatCurrency, formatDateTime } from '@/lib/format-utils';
import { DbRequest, Profile } from '@/types/types';

interface SalesInvoicePrintProps {
  request: DbRequest;
  client?: Profile;
  invoiceNo?: string;
}

export const SalesInvoicePrint: React.FC<SalesInvoicePrintProps> = ({ request, client, invoiceNo }) => {
  const items = request.request_items || [];
  const MAX_ROWS = 25;

  // Calculate totals
  const subTotal = items.reduce((sum, item) => {
    const base = (item.price_at_order || 0) * item.quantity;
    return sum + base;
  }, 0);

  const itemDiscountsTotal = items.reduce((sum, item) => {
    const base = (item.price_at_order || 0) * item.quantity;
    const disc = (item.discount_percentage || 0) / 100;
    return sum + (base * disc);
  }, 0);

  const overallDiscount = request.discount_amount || 0;
  const afterDiscount = subTotal - itemDiscountsTotal - overallDiscount;
  const ppn = Math.round(afterDiscount * 0.11);
  const totalInvoice = afterDiscount + ppn;

  // Number to words (Indonesian)
  const numToWords = (n: number): string => {
    const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    if (n < 12) return satuan[n];
    if (n < 20) return satuan[n - 10] + ' belas';
    if (n < 100) return satuan[Math.floor(n / 10)] + ' puluh ' + satuan[n % 10];
    if (n < 200) return 'seratus ' + numToWords(n - 100);
    if (n < 1000) return satuan[Math.floor(n / 100)] + ' ratus ' + numToWords(n % 100);
    if (n < 2000) return 'seribu ' + numToWords(n - 1000);
    if (n < 1000000) return numToWords(Math.floor(n / 1000)) + ' ribu ' + numToWords(n % 1000);
    if (n < 1000000000) return numToWords(Math.floor(n / 1000000)) + ' juta ' + numToWords(n % 1000000);
    return numToWords(Math.floor(n / 1000000000)) + ' milyar ' + numToWords(n % 1000000000);
  };

  const sayAmount = numToWords(Math.round(totalInvoice)).trim().replace(/\s+/g, ' ');
  const dateStr = formatDateTime(request.created_at).split(' ')[0];
  const invNo = invoiceNo || request.id.slice(0, 6).toUpperCase();

  // Build empty rows to fill table
  const emptyRows = Math.max(0, MAX_ROWS - items.length);

  return (
    <div className="si-page">
      <style>{`
        .si-page {
          width: 210mm;
          height: 297mm;
          padding: 8mm 10mm 6mm 10mm;
          box-sizing: border-box;
          font-family: 'Courier New', Courier, monospace;
          font-size: 9pt;
          color: #000;
          background: #fff;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* ── HEADER ── */
        .si-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #000;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        .si-header-left {
          max-width: 55%;
        }
        .si-company {
          font-weight: bold;
          font-size: 11pt;
          letter-spacing: 0.5px;
        }
        .si-addr {
          font-size: 8pt;
          line-height: 1.4;
          margin-top: 1mm;
        }
        .si-header-right {
          text-align: right;
        }
        .si-title {
          font-size: 18pt;
          font-weight: bold;
          font-style: italic;
          letter-spacing: 1px;
        }
        .si-meta-table {
          margin-top: 2mm;
          border-collapse: collapse;
          font-size: 8pt;
          margin-left: auto;
        }
        .si-meta-table td {
          padding: 0.5mm 2mm;
          border: 1px solid #000;
          white-space: nowrap;
        }
        .si-meta-table td:first-child {
          font-weight: bold;
          text-align: left;
        }
        .si-meta-table td:last-child {
          min-width: 22mm;
          text-align: left;
        }

        /* ── CUSTOMER ── */
        .si-customer {
          display: flex;
          gap: 6mm;
          margin-bottom: 2mm;
          font-size: 8pt;
          line-height: 1.4;
        }
        .si-customer-block {
          flex: 1;
        }
        .si-customer-label {
          font-weight: bold;
          font-size: 8pt;
          margin-bottom: 0.5mm;
        }

        /* ── ITEM TABLE ── */
        .si-items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
          flex: 1;
        }
        .si-items-table th,
        .si-items-table td {
          border: 1px solid #000;
          padding: 1mm 1.5mm;
          vertical-align: top;
        }
        .si-items-table th {
          background: transparent;
          font-weight: bold;
          text-align: center;
          font-size: 8pt;
          white-space: nowrap;
        }
        .si-items-table td.num {
          text-align: center;
        }
        .si-items-table td.right {
          text-align: right;
        }
        .si-items-table .empty-row td {
          height: 5.5mm;
        }

        /* Column widths */
        .si-col-no { width: 7mm; }
        .si-col-nama { width: auto; }
        .si-col-harga { width: 22mm; }
        .si-col-qty { width: 10mm; }
        .si-col-kemasan { width: 18mm; }
        .si-col-disc { width: 14mm; }
        .si-col-amount { width: 26mm; }

        /* ── FOOTER ── */
        .si-footer {
          margin-top: 1mm;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 4mm;
        }
        .si-footer-left {
          flex: 1;
          font-size: 8pt;
        }
        .si-say-box {
          border: 1px solid #000;
          padding: 1mm 2mm;
          margin-bottom: 1mm;
          min-height: 7mm;
          font-size: 7.5pt;
          font-style: italic;
        }
        .si-say-label {
          font-weight: bold;
          font-style: normal;
        }
        .si-desc-label {
          font-weight: bold;
          margin-top: 1mm;
          font-size: 8pt;
        }
        .si-signatures {
          display: flex;
          gap: 14mm;
          margin-top: 8mm;
          font-size: 8pt;
        }
        .si-sig-block {
          text-align: center;
        }
        .si-sig-line {
          width: 28mm;
          border-bottom: 1px solid #000;
          margin-bottom: 1mm;
          height: 14mm;
        }
        .si-sig-label {
          font-weight: bold;
          font-size: 7.5pt;
        }

        /* Summary box */
        .si-summary-box {
          border: 1px solid #000;
          border-collapse: collapse;
          font-size: 8.5pt;
          min-width: 60mm;
        }
        .si-summary-box td {
          border: 1px solid #000;
          padding: 1mm 2mm;
        }
        .si-summary-box td:first-child {
          font-weight: bold;
          text-align: right;
          white-space: nowrap;
        }
        .si-summary-box td:last-child {
          text-align: right;
          min-width: 28mm;
        }
        .si-summary-box .si-total-row td {
          font-weight: bold;
          font-size: 9pt;
        }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div className="si-header">
        <div className="si-header-left">
          <div className="si-company">PT. SARANA MEGAMEDILAP SEJAHTERA</div>
          <div className="si-addr">
            PERUMAHAN TAMAN CIMANGGU<br />
            BLOK V.1 NO. 32 RT. 01 / RW. 012<br />
            BOGOR - NPWP 66.500.624.3-404.000
          </div>
        </div>
        <div className="si-header-right">
          <div className="si-title">Sales Invoice</div>
          <table className="si-meta-table">
            <tbody>
              <tr><td>Invoice Date</td><td>{dateStr}</td></tr>
              <tr><td>Invoice No.</td><td>{invNo}</td></tr>
              <tr><td>PO No.</td><td></td></tr>
              <tr><td>Terms</td><td>Net 30</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ CUSTOMER ═══ */}
      <div className="si-customer">
        <div className="si-customer-block">
          <div className="si-customer-label">Bill To :</div>
          <div><strong>{client?.name || request.user_email || '-'}</strong></div>
          {client?.phone && <div>Phone: {client.phone}</div>}
        </div>
        <div className="si-customer-block">
          <div className="si-customer-label">Ship To :</div>
          <div><strong>{client?.name || request.user_email || '-'}</strong></div>
          {client?.phone && <div>Phone: {client.phone}</div>}
        </div>
      </div>

      {/* ═══ ITEM TABLE ═══ */}
      <table className="si-items-table">
        <thead>
          <tr>
            <th className="si-col-no">No.</th>
            <th className="si-col-nama">Nama Barang</th>
            <th className="si-col-harga">Harga Satuan</th>
            <th className="si-col-qty">Qty</th>
            <th className="si-col-kemasan">Kemasan</th>
            <th className="si-col-disc">Disc %</th>
            <th className="si-col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const unitPrice = item.price_at_order || 0;
            const disc = item.discount_percentage || 0;
            const lineTotal = unitPrice * item.quantity * (1 - disc / 100);

            return (
              <tr key={idx}>
                <td className="num">{idx + 1}</td>
                <td>{item.products?.name || item.product_id}</td>
                <td className="right">{unitPrice.toLocaleString('id-ID')}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">PCS</td>
                <td className="num">{disc > 0 ? disc : 0}</td>
                <td className="right">{Math.round(lineTotal).toLocaleString('id-ID')}</td>
              </tr>
            );
          })}
          {/* Fill empty rows to maintain fixed table height */}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`empty-${i}`} className="empty-row">
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ═══ FOOTER ═══ */}
      <div className="si-footer">
        <div className="si-footer-left">
          <div className="si-say-box">
            <span className="si-say-label">Say : </span>
            {sayAmount}
          </div>
          <div className="si-desc-label">Description:</div>
          <div className="si-signatures">
            <div className="si-sig-block">
              <div className="si-sig-line"></div>
              <div className="si-sig-label">Disiapkan</div>
            </div>
            <div className="si-sig-block">
              <div className="si-sig-line"></div>
              <div className="si-sig-label">Diterima oleh</div>
            </div>
          </div>
        </div>

        <table className="si-summary-box">
          <tbody>
            <tr>
              <td>Sub Total :</td>
              <td>{subTotal.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Discount :</td>
              <td>{(itemDiscountsTotal + overallDiscount) > 0 ? (itemDiscountsTotal + overallDiscount).toLocaleString('id-ID') : ''}</td>
            </tr>
            <tr>
              <td>PPN :</td>
              <td>{ppn.toLocaleString('id-ID')}</td>
            </tr>
            <tr className="si-total-row">
              <td>Total Invoice :</td>
              <td>{totalInvoice.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
