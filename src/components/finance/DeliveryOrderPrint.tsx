'use client';

import React from 'react';
import { formatDateTime } from '@/lib/format-utils';
import { DbRequest, Profile } from '@/types/types';

interface DeliveryOrderPrintProps {
  request: DbRequest;
  client?: Profile;
  deliveryNo?: string;
}

export const DeliveryOrderPrint: React.FC<DeliveryOrderPrintProps> = ({ request, client, deliveryNo }) => {
  const items = request.request_items || [];
  const MAX_ROWS = 30;

  const dateStr = formatDateTime(request.created_at).split(' ')[0];
  const doNo = deliveryNo || request.id.slice(0, 6).toUpperCase();

  const emptyRows = Math.max(0, MAX_ROWS - items.length);

  return (
    <div className="do-page">
      <style>{`
        .do-page {
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
        .do-top-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2mm;
        }
        .do-top-left {
          flex: 1;
          padding-right: 4mm;
        }
        .do-company-box {
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          padding: 1.5mm 3mm;
          margin-bottom: 2mm;
          width: fit-content;
          background: #fafafa;
        }
        .do-company {
          font-weight: 600;
          font-size: 10.5pt;
          letter-spacing: -0.2px;
          color: #1d1d1f;
        }
        .do-addr {
          font-size: 7.5pt;
          line-height: 1.5;
          margin-top: 1.5mm;
          margin-bottom: 4mm;
          color: #515154;
        }
        .do-top-right {
          text-align: right;
          width: 65mm;
        }
        .do-title {
          font-size: 20pt;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 3mm;
          color: #1d1d1f;
        }
        .do-meta-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          font-size: 8pt;
          overflow: hidden;
        }
        .do-meta-table td {
          border-bottom: 1px solid #d2d2d7;
          border-right: 1px solid #d2d2d7;
          padding: 1.5mm 2mm;
          vertical-align: top;
          height: 9mm;
          width: 50%;
        }
        .do-meta-table tr:last-child td {
          border-bottom: none;
        }
        .do-meta-table td:last-child {
          border-right: none;
        }
        .do-meta-label {
          font-size: 6.5pt;
          text-align: left;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .do-meta-value {
          text-align: right;
          margin-top: 0.5mm;
          font-weight: 500;
          color: #1d1d1f;
        }

        /* ── CUSTOMER ── */
        .do-customer-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 2mm;
          font-size: 8.5pt;
        }
        .do-customer-table td {
          vertical-align: top;
        }
        .do-col-label {
          width: 14mm;
          font-weight: 600;
          color: #515154;
          padding: 1.5mm 0;
        }
        .do-col-colon {
          width: 3mm;
          color: #86868b;
          padding: 1.5mm 0;
        }
        .do-box-cell {
          border-left: 1px solid #d2d2d7;
          border-right: 1px solid #d2d2d7;
          border-bottom: 1px solid #e5e5ea;
          padding: 1.5mm 3mm;
        }
        .do-box-name {
          font-weight: 600;
          color: #1d1d1f;
          background: #fafafa;
        }
        .do-box-addr {
          color: #515154;
          line-height: 1.5;
        }
        .do-radius-top {
          border-top: 1px solid #d2d2d7;
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
        }
        .do-radius-bot {
          border-bottom: 1px solid #d2d2d7;
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }

        /* ── ITEM TABLE ── */
        .do-items-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #e5e5ea;
          border-radius: 8px;
          font-size: 8pt;
          flex: 1;
          overflow: hidden;
        }
        .do-items-table th,
        .do-items-table td {
          padding: 0.5mm 2mm;
          vertical-align: top;
          border-bottom: 1px solid #e5e5ea;
          border-right: 1px solid #e5e5ea;
        }
        .do-items-table th:last-child,
        .do-items-table td:last-child {
          border-right: none;
        }
        .do-items-table tr:last-child td {
          border-bottom: none;
        }
        .do-items-table th {
          background: #fafafa;
          font-weight: 600;
          text-align: center;
          color: #515154;
          white-space: nowrap;
          border-bottom: 1px solid #d2d2d7;
        }
        .do-items-table td.num {
          text-align: center;
        }
        .do-items-table .empty-row td {
          height: 5mm;
          border-bottom: 1px dashed #f5f5f7;
        }
        .do-items-table tr.empty-row:last-child td {
          border-bottom: none;
        }

        /* Column widths */
        .do-col-no { width: 7mm; }
        .do-col-item { width: auto; }
        .do-col-qty { width: 14mm; }
        .do-col-nie { width: 36mm; }
        .do-col-lot { width: 44mm; }

        /* ── FOOTER ── */
        .do-footer {
          margin-top: 3mm;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 4mm;
        }
        .do-signatures {
          display: flex;
          gap: 4mm;
          width: 100%;
        }
        .do-sig-block {
          flex: 1;
          text-align: center;
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          padding: 2mm;
          font-size: 7.5pt;
          background: #fafafa;
        }
        .do-sig-title {
          font-weight: 600;
          font-size: 7.5pt;
          border-bottom: 1px solid #d2d2d7;
          padding-bottom: 1.5mm;
          margin-bottom: 1.5mm;
          color: #1d1d1f;
        }
        .do-sig-space {
          height: 10mm;
        }
        .do-sig-date {
          font-size: 7pt;
          border-top: 1px solid #d2d2d7;
          padding-top: 1mm;
          margin-top: 1mm;
          color: #86868b;
        }

        .do-desc-box {
          border: 1px solid #d2d2d7;
          border-radius: 8px;
          min-width: 42mm;
          padding: 1.5mm 3mm;
          font-size: 7.5pt;
          align-self: stretch;
          background: #fafafa;
        }
        .do-desc-title {
          font-weight: 600;
          font-size: 7.5pt;
          margin-bottom: 1mm;
          color: #1d1d1f;
        }
      `}</style>

      {/* ═══ TOP SECTION ═══ */}
      <div className="do-top-section">
        <div className="do-top-left">
          <div className="do-company-box">
            <div className="do-company">PT. SARANA MEGAMEDILAB SEJAHTERA</div>
            <div className="do-addr">
              PERUMAHAN TAMAN CIMANGGU<br />
              BLOK V 1 NO. 32 RT. 01 / RW. 012<br />
              BOGOR - NPWP 66.500.624.3-404.000
            </div>
          </div>
          
          <table className="do-customer-table">
            <tbody>
              <tr>
                <td className="do-col-label" rowSpan={2}>Bill To</td>
                <td className="do-col-colon" rowSpan={2}>:</td>
                <td className="do-box-cell do-box-name do-radius-top">
                  {client?.name || request.user_email || '-'}
                </td>
              </tr>
              <tr>
                <td className="do-box-cell do-box-addr" style={{ borderBottom: '1px solid #d2d2d7' }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {client?.address || '-'}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="do-col-label" rowSpan={2} style={{ paddingTop: '2.5mm' }}>Ship To</td>
                <td className="do-col-colon" rowSpan={2} style={{ paddingTop: '2.5mm' }}>:</td>
                <td className="do-box-cell do-box-name">
                  {client?.name || request.user_email || '-'}
                </td>
              </tr>
              <tr>
                <td className="do-box-cell do-box-addr do-radius-bot">
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {client?.address || '-'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="do-top-right">
          <div className="do-title">Delivery Order</div>
          <table className="do-meta-table">
            <tbody>
              <tr>
                <td>
                  <div className="do-meta-label">Delivery Date</div>
                  <div className="do-meta-value">{dateStr}</div>
                </td>
                <td>
                  <div className="do-meta-label">Delivery No.</div>
                  <div className="do-meta-value">{doNo}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="do-meta-label">Ship Via</div>
                  <div className="do-meta-value"></div>
                </td>
                <td>
                  <div className="do-meta-label">Terms</div>
                  <div className="do-meta-value">Net 30</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ ITEM TABLE ═══ */}
      <table className="do-items-table">
        <thead>
          <tr>
            <th className="do-col-no">No.</th>
            <th className="do-col-item">Item Description</th>
            <th className="do-col-qty">Qty</th>
            <th className="do-col-nie">N.I.E</th>
            <th className="do-col-lot">LOT / ED / Kemasan</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const nie = item.products?.nie || item.products?.sku || '-';
            const lot = item.products?.lot_number || '-';
            const ed = item.products?.expiry_date
              ? new Date(item.products.expiry_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '-';
            const kemasan = item.products?.unit?.toUpperCase() || '-';

            return (
              <tr key={idx}>
                <td className="num">{idx + 1}</td>
                <td>{item.products?.name || item.product_id}</td>
                <td className="num">{item.quantity} {kemasan}</td>
                <td>{nie}</td>
                <td>{lot} / {ed} / {kemasan}</td>
              </tr>
            );
          })}
          {/* Fill empty rows */}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`empty-${i}`} className="empty-row">
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ═══ FOOTER ═══ */}
      <div className="do-footer">
        <div className="do-signatures">
          <div className="do-sig-block">
            <div className="do-sig-title">Created By</div>
            <div className="do-sig-space"></div>
            <div className="do-sig-date">Date: ............</div>
          </div>
          <div className="do-sig-block">
            <div className="do-sig-title">Approved By</div>
            <div className="do-sig-space"></div>
            <div className="do-sig-date">Date: ............</div>
          </div>
          <div className="do-sig-block">
            <div className="do-sig-title">Shipped By</div>
            <div className="do-sig-space"></div>
            <div className="do-sig-date">Date: ............</div>
          </div>
          <div className="do-sig-block">
            <div className="do-sig-title">Received By</div>
            <div className="do-sig-space"></div>
            <div className="do-sig-date">Date: ............</div>
          </div>
        </div>

        <div className="do-desc-box">
          <div className="do-desc-title">Description:</div>
          <div style={{ minHeight: '14mm' }}></div>
        </div>
      </div>
    </div>
  );
};
