'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { Invoice } from '@/types/types';

export default function TaxDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [fetching, setFetching] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/tax')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = async (fromDate = from, toDate = to) => {
    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`);
    const { data } = await query;
    setInvoices((data || []) as Invoice[]);
    setFetching(false);
  };

  useEffect(() => {
    if (!profile) return;

    const run = async () => {
      const query = supabase.from('invoices').select('*').order('created_at', { ascending: false });
      const { data } = await query;
      setInvoices((data || []) as Invoice[]);
      setFetching(false);
    };

    run();
  }, [profile]);

  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalTax = invoices.reduce((sum, invoice) => sum + (invoice.tax_amount || 0), 0);
  const paidRevenue = invoices.filter((invoice) => invoice.paid).reduce((sum, invoice) => sum + invoice.amount, 0);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tax & Sales Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Invoice-based tax reporting.</p>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-white border-gray-200 shadow-sm border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-teal-500"
        />
        <span className="text-gray-500">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-white border-gray-200 shadow-sm border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-teal-500"
        />
        <button onClick={() => refresh()} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors">
          Filter
        </button>
        <button
          onClick={() => {
            setFrom('');
            setTo('');
            refresh('', '');
          }}
          className="px-4 py-2 bg-gray-100 hover:bg-slate-700 text-gray-600 text-sm rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sales', value: `Rp${totalRevenue.toLocaleString('id-ID')}`, color: 'text-gray-900' },
          { label: 'Tax Collected (11%)', value: `Rp${totalTax.toLocaleString('id-ID')}`, color: 'text-teal-400' },
          { label: 'Paid', value: `Rp${paidRevenue.toLocaleString('id-ID')}`, color: 'text-green-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <p className="text-gray-500 text-xs">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices ({invoices.length})</h2>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Invoice No.</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Amount</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Tax</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">No invoices found</td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-200/50 hover:bg-gray-100/30 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-mono text-xs">{invoice.invoice_number}</td>
                    <td className="px-4 py-3 text-right text-gray-900">Rp{invoice.amount.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right text-teal-400">Rp{(invoice.tax_amount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${invoice.paid ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {invoice.paid ? 'PAID' : 'UNPAID'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {new Date(invoice.created_at).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
