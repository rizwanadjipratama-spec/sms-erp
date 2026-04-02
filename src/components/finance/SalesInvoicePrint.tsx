import React from 'react';
import { formatCurrency, formatDateTime } from '@/lib/format-utils';
import { DbRequest, Profile } from '@/types/types';

interface SalesInvoicePrintProps {
  request: DbRequest;
  client?: Profile;
}

export const SalesInvoicePrint: React.FC<SalesInvoicePrintProps> = ({ request, client }) => {
  const items = request.request_items || [];
  
  // Calculate Subtotals
  const subTotal = items.reduce((sum, item) => sum + ((item.price_at_order || 0) * item.quantity), 0);
  const itemDiscountsTotal = items.reduce((sum, item) => {
    const base = (item.price_at_order || 0) * item.quantity;
    const finalPrice = base * (1 - (item.discount_percentage || 0) / 100);
    return sum + (base - finalPrice);
  }, 0);
  
  const grandTotal = subTotal - itemDiscountsTotal - (request.discount_amount || 0);

  return (
    <div className="bg-white w-full h-full p-8 text-black text-sm font-sans" style={{ minHeight: '29.7cm' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-black">Company Name</h1>
          <p className="mt-1 text-xs max-w-xs text-black">
            123 Business Road, Industrial Estate.<br/>
            City, Country 12345<br/>
            Phone: (123) 456-7890
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold uppercase tracking-widest text-black">SALES INVOICE</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-left">
            <span className="font-semibold">Invoice No:</span>
            <span>INV-{request.id.slice(0, 8).toUpperCase()}</span>
            <span className="font-semibold">Date:</span>
            <span>{formatDateTime(request.created_at).split(' ')[0]}</span>
            <span className="font-semibold">Terms:</span>
            <span>Net 30 Days</span>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <p className="font-bold text-xs uppercase border-b border-black mb-2 pb-1">Bill To</p>
          <p className="font-semibold">{client?.name || request.user_email}</p>
          {client?.phone && <p className="text-xs mt-1">Phone: {client.phone}</p>}
        </div>
        <div>
          <p className="font-bold text-xs uppercase border-b border-black mb-2 pb-1">Ship To</p>
          <p className="font-semibold">{client?.name || request.user_email}</p>
          {client?.phone && <p className="text-xs mt-1">Phone: {client.phone}</p>}
        </div>
      </div>

      {/* Main Table */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-2 px-2 text-left w-12 font-bold uppercase text-xs">No</th>
            <th className="py-2 px-2 text-left font-bold uppercase text-xs">Description</th>
            <th className="py-2 px-2 text-center w-20 font-bold uppercase text-xs">Qty</th>
            <th className="py-2 px-2 text-right w-32 font-bold uppercase text-xs">Unit Price</th>
            <th className="py-2 px-2 text-center w-20 font-bold uppercase text-xs">Disc %</th>
            <th className="py-2 px-2 text-right w-36 font-bold uppercase text-xs">Amount</th>
          </tr>
        </thead>
        <tbody className="border-b-2 border-black">
          {items.map((item, idx) => {
            const basePrice = item.price_at_order || 0;
            const lineTotal = basePrice * item.quantity;
            const finalLineTotal = lineTotal * (1 - (item.discount_percentage || 0) / 100);
            
            return (
              <tr key={idx} className="border-b border-gray-200 last:border-0 h-10">
                <td className="py-2 px-2 align-top">{idx + 1}</td>
                <td className="py-2 px-2 align-top font-medium">{item.products?.name || item.product_id}</td>
                <td className="py-2 px-2 text-center align-top">{item.quantity}</td>
                <td className="py-2 px-2 text-right align-top">{formatCurrency(basePrice)}</td>
                <td className="py-2 px-2 text-center align-top">{item.discount_percentage ? `${item.discount_percentage}%` : '-'}</td>
                <td className="py-2 px-2 text-right align-top">{formatCurrency(finalLineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals & Notes */}
      <div className="grid grid-cols-[1fr_300px] gap-8">
        <div>
          <p className="font-bold text-xs uppercase mb-1">Remarks / Details</p>
          <div className="h-24 w-full border border-black p-2 text-xs italic">
            Please make all checks payable to Company Name.
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between font-medium">
            <span>Subtotal</span>
            <span>{formatCurrency(subTotal)}</span>
          </div>
          {itemDiscountsTotal > 0 && (
            <div className="flex justify-between font-medium text-xs">
              <span>Item Discounts</span>
              <span>-{formatCurrency(itemDiscountsTotal)}</span>
            </div>
          )}
          {(request.discount_amount || 0) > 0 && (
            <div className="flex justify-between font-medium">
              <span>Additional Discount</span>
              <span>-{formatCurrency(request.discount_amount || 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t-2 border-black pt-2 mt-2">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-16 grid grid-cols-3 gap-8 text-center text-xs">
        <div>
          <div className="border-b border-black w-32 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold">Received By</p>
        </div>
        <div>
          <div className="border-b border-black w-32 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold">Delivered By</p>
        </div>
        <div>
          <div className="border-b border-black w-32 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold">Authorized By</p>
        </div>
      </div>
    </div>
  );
};
