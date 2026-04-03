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
  const MAX_ROWS = 30;

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

  const sayAmount = totalInvoice > 0
    ? (numToWords(Math.round(totalInvoice)).trim().replace(/\s+/g, ' ') + ' rupiah').replace(/^./, c => c.toUpperCase())
    : 'Nol rupiah';
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
          padding: 10mm 12mm 8mm 12mm;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
          font-size: 8.5pt;
          color: #1d1d1f;
          background: #fff;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* ── TOP SECTION ── */
        .si-top-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 4mm;
        }
        .si-top-left {
          flex: 1;
          padding-right: 4mm;
        }
        .si-company-box {
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          padding: 3mm 4mm;
          margin-bottom: 4mm;
          width: fit-content;
          background: #fafafa;
        }
        .si-company {
          font-weight: 600;
          font-size: 10.5pt;
          letter-spacing: -0.2px;
          color: #1d1d1f;
        }
        .si-addr {
          font-size: 7.5pt;
          line-height: 1.5;
          margin-top: 1.5mm;
          color: #515154;
        }
        .si-top-right {
          text-align: right;
          width: 65mm; /* reduced width so it doesn't collide */
        }
        .si-title {
          font-size: 20pt;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 3mm;
          color: #1d1d1f;
        }
        .si-meta-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          font-size: 8pt;
          overflow: hidden;
        }
        .si-meta-table td {
          border-bottom: 1px solid #d2d2d7;
          border-right: 1px solid #d2d2d7;
          padding: 1.5mm 2mm;
          vertical-align: top;
          height: 9mm;
          width: 50%;
        }
        .si-meta-table tr:last-child td {
          border-bottom: none;
        }
        .si-meta-table td:last-child {
          border-right: none;
        }
        .si-meta-label {
          font-size: 6.5pt;
          text-align: left;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .si-meta-value {
          text-align: right;
          margin-top: 0.5mm;
          font-weight: 500;
          color: #1d1d1f;
        }

        /* ── CUSTOMER ── */
        .si-customer-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 4mm;
          font-size: 8.5pt;
        }
        .si-customer-table td {
          vertical-align: top;
        }
        .si-col-label {
          width: 14mm;
          font-weight: 600;
          color: #515154;
          padding: 1.5mm 0;
        }
        .si-col-colon {
          width: 3mm;
          color: #86868b;
          padding: 1.5mm 0;
        }
        .si-box-cell {
          border-left: 1px solid #d2d2d7;
          border-right: 1px solid #d2d2d7;
          border-bottom: 1px solid #e5e5ea;
          padding: 1.5mm 3mm;
        }
        .si-box-name {
          font-weight: 600;
          color: #1d1d1f;
          background: #fafafa;
        }
        .si-box-addr {
          color: #515154;
          line-height: 1.5;
        }
        .si-radius-top {
          border-top: 1px solid #d2d2d7;
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
        }
        .si-radius-bot {
          border-bottom: 1px solid #d2d2d7;
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }

        /* ── ITEM TABLE ── */
        .si-items-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #e5e5ea;
          border-radius: 8px;
          font-size: 8pt;
          flex: 1;
          font-variant-numeric: tabular-nums;
          overflow: hidden;
        }
        .si-items-table th,
        .si-items-table td {
          padding: 0.5mm 2mm;
          vertical-align: top;
          border-bottom: 1px solid #e5e5ea;
          border-right: 1px solid #e5e5ea;
        }
        .si-items-table tr:last-child td { border-bottom: none; }
        .si-items-table th:last-child,
        .si-items-table td:last-child { border-right: none; }
        .si-items-table th {
          background: #fafafa;
          font-weight: 600;
          text-align: center;
          color: #515154;
          white-space: nowrap;
          border-bottom: 1px solid #d2d2d7;
        }
        .si-items-table td.num { text-align: center; }
        .si-items-table td.right { text-align: right; }
        .si-items-table .empty-row td {
          height: 5mm;
          border-bottom: 1px dashed #f5f5f7;
        }
        .si-items-table tr.empty-row:last-child td {
          border-bottom: none;
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
          margin-top: 2mm;
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 4mm;
        }
        .si-footer-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          font-size: 8pt;
        }
        .si-say-box {
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          padding: 1.5mm 3mm;
          margin-bottom: 1mm;
          min-height: 5mm;
          font-size: 8pt;
          font-style: italic;
          background: #fafafa;
          color: #515154;
        }
        .si-say-label {
          font-weight: 600;
          font-style: normal;
          color: #1d1d1f;
        }
        .si-desc-label {
          font-weight: 600;
          margin-top: 1mm;
          font-size: 8pt;
          color: #515154;
        }
        .si-signatures {
          display: flex;
          gap: 14mm;
          margin-top: auto;
          font-size: 8pt;
        }
        .si-sig-block {
          text-align: center;
        }
        .si-sig-line {
          width: 28mm;
          border-bottom: 1px solid #86868b;
          margin-bottom: 1mm;
          height: 9mm;
        }
        .si-sig-label {
          font-weight: 600;
          font-size: 7.5pt;
          color: #515154;
        }

        /* Summary box */
        .si-summary-box {
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 8.5pt;
          min-width: 60mm;
          overflow: hidden;
        }
        .si-summary-box td {
          border-bottom: 1px solid #e5e5ea;
          border-right: 1px solid #e5e5ea;
          padding: 1.5mm 2.5mm;
        }
        .si-summary-box tr:last-child td { border-bottom: none; }
        .si-summary-box td:last-child { border-right: none; }
        .si-summary-box td:first-child {
          font-weight: 600;
          text-align: right;
          white-space: nowrap;
          background: #fafafa;
          color: #515154;
        }
        .si-summary-box td:last-child {
          text-align: right;
          min-width: 28mm;
          font-variant-numeric: tabular-nums;
        }
        .si-summary-box .si-total-row td {
          font-weight: 700;
          font-size: 9.5pt;
          color: #1d1d1f;
          background: #fff;
          border-top: 1px solid #d2d2d7;
        }
      `}</style>

      {/* ═══ TOP SECTION ═══ */}
      <div className="si-top-section">
        <div className="si-top-left">
          <div className="si-company-box">
            <div className="si-company">PT. SARANA MEGAMEDILAB SEJAHTERA</div>
            <div className="si-addr">
              PERUMAHAN TAMAN CIMANGGU<br />
              BLOK V 1 NO. 32 RT. 01 / RW. 012<br />
              BOGOR - NPWP 66.500.624.3-404.000
            </div>
          </div>
          
          <table className="si-customer-table">
            <tbody>
              <tr>
                <td className="si-col-label" rowSpan={2}>Bill To</td>
                <td className="si-col-colon" rowSpan={2}>:</td>
                <td className="si-box-cell si-box-name si-radius-top">
                  {client?.name || request.user_email || '-'}
                </td>
              </tr>
              <tr>
                <td className="si-box-cell si-box-addr" style={{ borderBottom: '1px solid #d2d2d7' }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {client?.address || '-'}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="si-col-label" rowSpan={2} style={{ paddingTop: '2.5mm' }}>Ship To</td>
                <td className="si-col-colon" rowSpan={2} style={{ paddingTop: '2.5mm' }}>:</td>
                <td className="si-box-cell si-box-name">
                  {client?.name || request.user_email || '-'}
                </td>
              </tr>
              <tr>
                <td className="si-box-cell si-box-addr si-radius-bot">
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {client?.address || '-'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="si-top-right">
          <div className="si-title">Sales Invoice</div>
          <table className="si-meta-table">
            <tbody>
              <tr>
                <td>
                  <div className="si-meta-label">Invoice Date</div>
                  <div className="si-meta-value">{dateStr}</div>
                </td>
                <td>
                  <div className="si-meta-label">Invoice No.</div>
                  <div className="si-meta-value">{invNo}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="si-meta-label">PO. No.</div>
                  <div className="si-meta-value"></div>
                </td>
                <td>
                  <div className="si-meta-label">Terms</div>
                  <div className="si-meta-value">Net 30</div>
                </td>
              </tr>
            </tbody>
          </table>
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
                <td className="num">{item.products?.unit?.toUpperCase() || '-'}</td>
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
