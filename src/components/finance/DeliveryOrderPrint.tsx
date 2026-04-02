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
  const MAX_ROWS = 20;

  const dateStr = formatDateTime(request.created_at).split(' ')[0];
  const doNo = deliveryNo || request.id.slice(0, 6).toUpperCase();

  const emptyRows = Math.max(0, MAX_ROWS - items.length);

  return (
    <div className="do-page">
      <style>{`
        .do-page {
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
        .do-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #000;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        .do-header-left {
          max-width: 55%;
        }
        .do-company {
          font-weight: bold;
          font-size: 11pt;
          letter-spacing: 0.5px;
        }
        .do-addr {
          font-size: 8pt;
          line-height: 1.4;
          margin-top: 1mm;
        }
        .do-header-right {
          text-align: right;
        }
        .do-title {
          font-size: 18pt;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .do-meta-table {
          margin-top: 2mm;
          border-collapse: collapse;
          font-size: 8pt;
          margin-left: auto;
        }
        .do-meta-table td {
          padding: 0.5mm 2mm;
          border: 1px solid #000;
          white-space: nowrap;
        }
        .do-meta-table td:first-child {
          font-weight: bold;
          text-align: left;
        }
        .do-meta-table td:last-child {
          min-width: 22mm;
          text-align: left;
        }

        /* ── CUSTOMER ── */
        .do-customer {
          display: flex;
          gap: 6mm;
          margin-bottom: 2mm;
          font-size: 8pt;
          line-height: 1.4;
        }
        .do-customer-block {
          flex: 1;
        }
        .do-customer-label {
          font-weight: bold;
          font-size: 8pt;
          margin-bottom: 0.5mm;
        }

        /* ── ITEM TABLE ── */
        .do-items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
          flex: 1;
        }
        .do-items-table th,
        .do-items-table td {
          border: 1px solid #000;
          padding: 1mm 1.5mm;
          vertical-align: top;
        }
        .do-items-table th {
          background: transparent;
          font-weight: bold;
          text-align: center;
          font-size: 8pt;
          white-space: nowrap;
        }
        .do-items-table td.num {
          text-align: center;
        }
        .do-items-table .empty-row td {
          height: 6mm;
        }

        /* Column widths */
        .do-col-no { width: 7mm; }
        .do-col-item { width: auto; }
        .do-col-qty { width: 12mm; }
        .do-col-nie { width: 36mm; }
        .do-col-lot { width: 48mm; }

        /* ── FOOTER ── */
        .do-footer {
          margin-top: 2mm;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 4mm;
        }
        .do-signatures {
          display: flex;
          gap: 2mm;
          width: 100%;
        }
        .do-sig-block {
          flex: 1;
          text-align: center;
          border: 1px solid #000;
          padding: 1mm 1mm 2mm 1mm;
          font-size: 7.5pt;
        }
        .do-sig-title {
          font-weight: bold;
          font-size: 7.5pt;
          border-bottom: 1px solid #000;
          padding-bottom: 1mm;
          margin-bottom: 1mm;
        }
        .do-sig-space {
          height: 16mm;
        }
        .do-sig-date {
          font-size: 7pt;
          border-top: 1px solid #000;
          padding-top: 1mm;
          margin-top: 1mm;
        }

        .do-desc-box {
          border: 1px solid #000;
          min-width: 42mm;
          padding: 1mm 2mm;
          font-size: 7.5pt;
          align-self: stretch;
        }
        .do-desc-title {
          font-weight: bold;
          font-size: 7.5pt;
          margin-bottom: 1mm;
        }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div className="do-header">
        <div className="do-header-left">
          <div className="do-company">PT. SARANA MEGAMEDILAP SEJAHTERA</div>
          <div className="do-addr">
            PERUMAHAN TAMAN CIMANGGU<br />
            BLOK V.1 NO. 32 RT. 01 / RW. 012<br />
            BOGOR - NPWP 66.500.624.3-404.000
          </div>
        </div>
        <div className="do-header-right">
          <div className="do-title">Delivery Order</div>
          <table className="do-meta-table">
            <tbody>
              <tr><td>Delivery Date</td><td>{dateStr}</td></tr>
              <tr><td>Delivery No.</td><td>{doNo}</td></tr>
              <tr><td>Ship Via</td><td></td></tr>
              <tr><td>PO No.</td><td></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ CUSTOMER ═══ */}
      <div className="do-customer">
        <div className="do-customer-block">
          <div className="do-customer-label">Bill To :</div>
          <div><strong>{client?.name || request.user_email || '-'}</strong></div>
          {client?.phone && <div>Phone: {client.phone}</div>}
        </div>
        <div className="do-customer-block">
          <div className="do-customer-label">Ship To :</div>
          <div><strong>{client?.name || request.user_email || '-'}</strong></div>
          {client?.phone && <div>Phone: {client.phone}</div>}
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
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="num">{idx + 1}</td>
              <td>{item.products?.name || item.product_id}</td>
              <td className="num">{item.quantity}</td>
              <td></td>
              <td></td>
            </tr>
          ))}
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
