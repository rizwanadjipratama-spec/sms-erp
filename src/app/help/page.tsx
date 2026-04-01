'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { PageSpinner } from '@/components/ui/LoadingSkeleton';

function ClientHelp() {
  return (
    <div className="max-w-5xl mx-auto px-6 -mt-10 space-y-12 pb-20">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom border border-gray-100">
        <div className="p-8 md:p-10 border-b border-gray-100">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Client Tutorial: How to Use the SMS Lab Portal</h2>
          <p className="text-gray-500">Learn how to request products, track status, and report issues.</p>
        </div>
        
        <div className="p-8 md:p-10 bg-gray-50/50">
          <div className="relative border-l-2 border-green-200 ml-4 space-y-12 pb-4">
            
            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-500 ring-4 ring-green-50"></div>
              <h3 className="font-bold text-lg text-gray-900">1. Adding Products to Your Cart</h3>
              <p className="text-gray-600 mt-2">Go to the <Link href="/dashboard/client/products" className="text-blue-600 hover:underline font-semibold">Products Catalog</Link>. Browse available items in your branch and click "Add to List". You can request custom items if they aren't listed.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-500 ring-4 ring-green-50"></div>
              <h3 className="font-bold text-lg text-gray-900">2. Submitting Your Request</h3>
              <p className="text-gray-600 mt-2">Once your list is ready, go to <Link href="/request" className="text-blue-600 hover:underline font-semibold">New Request</Link>. Review your items, select your delivery address, and submit. The request will be sent to our Marketing team for pricing approval.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-500 ring-4 ring-green-50"></div>
              <h3 className="font-bold text-lg text-gray-900">3. Tracking Delivery</h3>
              <p className="text-gray-600 mt-2">You can monitor your request status directly from your <Link href="/dashboard" className="text-blue-600 hover:underline font-semibold">Dashboard</Link>. You will see when it is Approved, Preparing, and In Transit.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-red-500 ring-4 ring-red-50"></div>
              <h3 className="font-bold text-lg text-gray-900">4. Reporting Issues (Missing Items / Damaged Goods)</h3>
              <p className="text-gray-600 mt-2">If you receive your order and something is wrong (damaged, expired, or missing), navigate to the specific Request Details page and click <strong className="text-red-600">Report Issue</strong>. Upload a photo and describe the problem. Our team will verify and process a replacement.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-orange-50"></div>
              <h3 className="font-bold text-lg text-gray-900">5. Requesting Machine Repairs</h3>
              <p className="text-gray-600 mt-2">If a laboratory machine errors out, go to <strong className="text-black">Equipment & PM</strong> and log a <strong className="text-black">Service Call</strong>. A technician will be assigned to your location.</p>
            </div>

          </div>
        </div>
      </div>
      
      {/* Support contacts */}
      <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-blue-900">Need immediate assistance?</h3>
          <p className="text-blue-700 mt-1">If your issue is urgent, contact our Customer Support team directly.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <a href="mailto:support@sms-laboratory.com" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm">Contact Support</a>
        </div>
      </div>
    </div>
  );
}

function StaffHelp() {
  return (
    <div className="max-w-5xl mx-auto px-6 -mt-10 space-y-12 pb-20">
      {/* Core Request Workflow */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom border border-gray-100">
        <div className="p-8 md:p-10 border-b border-gray-100">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Internal Tutorial: Standard Operating Procedure</h2>
          <p className="text-gray-500">Follow this step-by-step pipeline from drafting to delivery. Confidential internal workflow.</p>
        </div>
        
        <div className="p-8 md:p-10 bg-gray-50/50">
          <div className="relative border-l-2 border-blue-200 ml-4 space-y-12 pb-4">
            
            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
              <h3 className="font-bold text-lg text-gray-900">1. Draft & Submit</h3>
              <p className="text-gray-600 mt-2">Clients navigate to the <strong className="text-black">/request</strong> page. They select an action (Purchase Product vs Order Service Issue). The request is bound to their specific branch (Bogor, Cirebon, or Purwokerto).</p>
              <div className="mt-3 bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
                <span className="font-bold">Important:</span> You cannot request inventory from a different branch due to stock isolation protocols.
              </div>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-purple-50"></div>
              <h3 className="font-bold text-lg text-gray-900">2. Pricing & Marketing Verification</h3>
              <p className="text-gray-600 mt-2">Marketing receives the 'pending' request. They apply pricing from the Price Lists, apply discounts if any, and transition the status to 'priced'.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-red-500 ring-4 ring-red-50"></div>
              <h3 className="font-bold text-lg text-gray-900">3. Boss/Manager Approval</h3>
              <p className="text-gray-600 mt-2">The request enters the 'priced' queue. The Boss reviews the financials and clicks Approve. Status becomes 'approved'.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 ring-4 ring-orange-50"></div>
              <h3 className="font-bold text-lg text-gray-900">4. Processing (Warehouse / Admin)</h3>
              <p className="text-gray-600 mt-2">For purchasing, the Warehouse prepares the stock. Inventory is reserved (atomic RPC decrement) preventing double booking.</p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50"></div>
              <h3 className="font-bold text-lg text-gray-900">5. Delivery & Completion</h3>
              <p className="text-gray-600 mt-2">The Courier or Technician picks up the order. They mark it as Delivered/Completed. Finance then generates the Faktur & Invoice.</p>
            </div>

          </div>
        </div>
      </div>

      {/* Other Workflows */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-3">Finance & Monthly Closing</h3>
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            Finance operates primarily on the Invoices and Faktur tab. At the end of the month, Finance triggers the `Monthly Closing` process. The system runs an atomic ledger compilation locking the month's financial transactions to prevent retrospective mutation.
          </p>
          <ul className="text-sm space-y-2 text-gray-700">
            <li className="flex gap-2"><span>•</span> Audit logs track every DML change on the finances.</li>
            <li className="flex gap-2"><span>•</span> Only Boss/Owner can see high-level P&L reports.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-3">Inventory Hardening</h3>
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            Stock counts cannot be updated manually. They are tied to <code>inventory_logs</code> representing Movement Types (in, out, transfer, adjustments). 
          </p>
          <ul className="text-sm space-y-2 text-gray-700">
            <li className="flex gap-2"><span>•</span> Stock is mathematically restricted from dropping below zero (DB Constraint).</li>
            <li className="flex gap-2"><span>•</span> Race conditions are eliminated using PostgreSQL RPCs.</li>
          </ul>
        </div>
      </div>

      {/* Support contacts */}
      <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-blue-900">System Errors?</h3>
          <p className="text-blue-700 mt-1">Contact internal IT support for database/server issues.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <a href="mailto:it@sms-laboratory.com" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm">Email IT Support</a>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const { profile, loading } = useAuth();
  
  if (loading) return <PageSpinner />;

  const isClient = profile?.role === 'client';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-black text-white pt-16 pb-24 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{isClient ? 'Help & Support' : 'ERP Documentation'}</h1>
        <p className="text-gray-400 max-w-xl mx-auto text-lg">
          {isClient 
            ? 'Everything you need to know to request supplies and manage your laboratory.' 
            : 'Internal documentation for standard operating procedures and system workflows.'}
        </p>
        
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/dashboard" className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform">Go to Dashboard</Link>
          <button onClick={() => window.history.back()} className="text-gray-300 px-6 py-2.5 rounded-full font-bold text-sm hover:text-white transition">Back</button>
        </div>
      </div>

      {isClient ? <ClientHelp /> : <StaffHelp />}
    </div>
  );
}
