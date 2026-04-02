import React from 'react';
import { formatDateTime } from '@/lib/format-utils';
import { DbRequest, Profile } from '@/types/types';

interface DeliveryOrderPrintProps {
  request: DbRequest;
  client?: Profile;
}

export const DeliveryOrderPrint: React.FC<DeliveryOrderPrintProps> = ({ request, client }) => {
  const items = request.request_items || [];

  return (
    <div className="bg-white w-full h-full p-8 text-black text-sm font-sans" style={{ minHeight: '29.7cm' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-widest text-black">Company Name</h1>
          <p className="mt-1 text-xs max-w-xs text-black">
            123 Business Road, Industrial Estate.<br/>
            City, Country 12345<br/>
            Phone: (123) 456-7890
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold uppercase tracking-widest text-black">DELIVERY ORDER</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-left">
            <span className="font-semibold">DO No:</span>
            <span>DO-{request.id.slice(0, 8).toUpperCase()}</span>
            <span className="font-semibold">Date:</span>
            <span>{formatDateTime(request.created_at).split(' ')[0]}</span>
            <span className="font-semibold">Ref INV:</span>
            <span>INV-{request.id.slice(0, 8).toUpperCase()}</span>
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
            <th className="py-2 px-2 text-center w-24 font-bold uppercase text-xs">Qty</th>
            <th className="py-2 px-2 text-center w-24 font-bold uppercase text-xs">UOM</th>
            <th className="py-2 px-2 text-left w-36 font-bold uppercase text-xs">Remarks</th>
          </tr>
        </thead>
        <tbody className="border-b-2 border-black">
          {items.map((item, idx) => {
            return (
              <tr key={idx} className="border-b border-gray-200 last:border-0 h-10">
                <td className="py-2 px-2 align-top">{idx + 1}</td>
                <td className="py-2 px-2 align-top font-medium">{item.products?.name || item.product_id}</td>
                <td className="py-2 px-2 text-center align-top">{item.quantity}</td>
                <td className="py-2 px-2 text-center align-top">PCS</td>
                <td className="py-2 px-2 text-left align-top"></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Notes */}
      <div className="mt-8">
        <p className="font-bold text-xs uppercase mb-1">Remarks / Details</p>
        <div className="h-20 w-1/2 border border-black p-2 text-xs italic">
          Goods received in good condition.
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-16 grid grid-cols-4 gap-4 text-center text-xs">
        <div>
          <div className="border-b border-black w-24 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold text-[10px]">Received By</p>
          <p className="text-[10px] mt-1 text-gray-500">(Customer)</p>
        </div>
        <div>
          <div className="border-b border-black w-24 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold text-[10px]">Delivered By</p>
          <p className="text-[10px] mt-1 text-gray-500">(Courier)</p>
        </div>
        <div>
          <div className="border-b border-black w-24 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold text-[10px]">Prepared By</p>
          <p className="text-[10px] mt-1 text-gray-500">(Warehouse)</p>
        </div>
        <div>
          <div className="border-b border-black w-24 mx-auto mb-2 mt-16"></div>
          <p className="uppercase font-bold text-[10px]">Authorized By</p>
          <p className="text-[10px] mt-1 text-gray-500">(Warehouse Mgr)</p>
        </div>
      </div>
    </div>
  );
};
