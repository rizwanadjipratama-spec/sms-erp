'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRequest } from '@/lib/request-context';
import Link from 'next/link';
import { productService } from '@/lib/product-service';
import { Product } from '@/types/types';
import { formatCurrency } from '@/lib/format-utils';

export default function RequestPage() {
  const { profile, loading } = useAuth();
  const { items, submit } = useRequest();

  const [submitting, setSubmitting] = useState(false);
  const [priority, setPriority] = useState<'normal' | 'cito'>('normal');
  const [reason, setReason] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    productService.fetchProducts()
      .then((data) => {
        setProducts(data);
        setProductsLoading(false);
      })
      .catch(() => setProductsLoading(false));
  }, []);

  const total = items.reduce((acc, item) => acc + (item.qty || 0), 0);
  const hasDebtIssue = profile?.debt_amount && profile.debt_amount > profile.debt_limit;

  if (loading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-bg">
        <div className="w-8 h-8 border-4 border-apple-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-bg px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-apple-gray-border">
          <h2 className="text-2xl font-black text-apple-text-primary mb-4">Login Required</h2>
          <p className="text-apple-text-secondary mb-8 font-medium">Please log in to submit a request.</p>
          <Link
            href="/login"
            className="inline-block bg-apple-text-primary text-white py-3 px-8 rounded-apple font-bold hover:bg-black transition active:scale-95"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-bg px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-apple-gray-border">
          <h2 className="text-2xl font-black text-apple-text-primary mb-4">No Items</h2>
          <p className="text-apple-text-secondary mb-8 font-medium">Add products to your cart before submitting.</p>
          <Link
            href="/dashboard/client/products"
            className="inline-block bg-apple-blue text-white py-3 px-8 rounded-apple font-bold hover:bg-apple-blue-hover transition active:scale-95 shadow-lg shadow-apple-blue/10"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await submit({
        priority,
        reason,
        promise_date: hasDebtIssue ? promiseDate : undefined,
        payment_note: hasDebtIssue ? paymentNote : undefined,
      });

      router.push('/dashboard/client');
    } catch (error: unknown) {
      console.error('Submit error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('Debt exceeds limit')) {
        alert('Payment promise is required before this request can be submitted.');
      } else {
        alert(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getProductName = (id: string) => {
    return products.find((p) => p.id === id)?.name || id;
  };

  return (
    <div className="min-h-screen bg-apple-gray-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white shadow-2xl rounded-[2rem] overflow-hidden border border-apple-gray-border"
        >
          <div className="p-8 sm:p-12 border-b border-apple-gray-border">
            <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">New Request</h1>
            <p className="text-apple-text-secondary mt-2 font-medium">Review your items and system requirements.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 sm:p-12">
            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">Cart Summary</h3>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm font-medium">
                      <span className="text-apple-text-primary">{getProductName(item.id)}</span>
                      <span className="text-apple-blue bg-apple-blue/10 px-2 py-0.5 rounded-full text-[10px] font-bold">x{item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-6 border-t border-apple-gray-border flex justify-between items-center font-black text-lg">
                  <span className="text-apple-text-primary">Total items</span>
                  <span className="text-apple-blue">{total}</span>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4 font-bold text-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-4">Priority Level</h3>
                  <label className="flex items-center gap-3 p-3 rounded-apple bg-apple-gray-bg border border-apple-gray-border cursor-pointer group transition-all">
                    <input type="radio" checked={priority === 'normal'} onChange={() => setPriority('normal')} className="w-4 h-4 text-apple-blue focus:ring-apple-blue" />
                    <span className="text-apple-text-primary group-hover:text-apple-blue transition-colors">Normal</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-apple bg-apple-gray-bg border border-apple-gray-border cursor-pointer group transition-all">
                    <input type="radio" checked={priority === 'cito'} onChange={() => setPriority('cito')} className="w-4 h-4 text-apple-danger focus:ring-apple-danger" />
                    <span className="text-apple-danger">CITO (Urgent)</span>
                  </label>
                </div>

                {priority === 'cito' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2">URGENCY REASON</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} required className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-medium focus:ring-4 focus:ring-apple-blue/10 outline-none transition-all resize-none" placeholder="Please specify why this is urgent..." rows={3} />
                  </div>
                )}

                {hasDebtIssue && (
                  <div className="bg-apple-warning/5 border border-apple-warning/20 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 text-apple-warning">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-black uppercase tracking-widest">DEBT LIMIT NOTICE</span>
                    </div>
                    <p className="text-[10px] font-bold text-apple-text-secondary leading-relaxed uppercase tracking-wider">Your debt ({formatCurrency(profile.debt_amount)}) exceeds limit ({formatCurrency(profile.debt_limit)}). Payment promise required.</p>
                    <div className="space-y-3">
                      <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-bold bg-white" required />
                      <textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-medium bg-white resize-none" placeholder="Payment plan details..." rows={2} required />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || total === 0}
              className="w-full bg-apple-text-primary text-white py-4 rounded-apple font-black text-sm hover:bg-black transition-all active:scale-95 shadow-2xl shadow-black/20 disabled:opacity-50"
            >
              {submitting ? 'SUBMITTING...' : `SUBMIT REQUEST (${total} ITEMS)`}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
