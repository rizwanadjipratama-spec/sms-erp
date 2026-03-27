'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRequest } from '@/lib/request-context';
import Link from 'next/link';
import { getProducts } from '@/lib/data';
import { Product } from '@/types/types';

export default function RequestPage() {
  const { profile, loading } = useAuth();
  const { items, submit } = useRequest();

  const [submitting, setSubmitting] = useState(false);
  const [priority, setPriority] = useState<'normal' | 'cito'>('normal');
  const [reason, setReason] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const router = useRouter();

  const hasDebtIssue =
    profile?.debt_amount && profile.debt_amount > profile.debt_limit;

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    getProducts().then((data) => {
      setProducts(data);
      setProductsLoading(false);
    });
  }, []);

  const total = items.reduce((acc, item) => acc + (item.qty || 0), 0);

  if (loading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Login Required
          </h2>
          <p className="text-gray-600 mb-8">
            Please log in to submit a request.
          </p>
          <Link
            href="/login"
            className="inline-block bg-gray-900 text-white py-3 px-8 rounded-lg font-medium hover:bg-black transition"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            No Items
          </h2>
          <p className="text-gray-600 mb-8">
            Add products to cart first.
          </p>
          <Link
            href="/"
            className="inline-block bg-gray-900 text-white py-3 px-8 rounded-lg font-medium hover:bg-black transition"
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

      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';

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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white shadow-xl rounded-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900">
              New Request
            </h1>
            <p className="text-gray-600 mt-2">
              Review cart and submit your request
            </p>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Cart Summary
                </h3>

                <div className="space-y-3">
                  {items.map((item: { id: string; qty: number }) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm"
                    >
                      <span>{getProductName(item.id)}</span>
                      <span className="font-medium">x{item.qty}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total items:</span>
                    <span>{total}</span>
                  </div>
                </div>
              </div>

              {hasDebtIssue && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-amber-800">
                    Debt Notice: Rp
                    {profile!.debt_amount.toLocaleString()} {'>'} limit Rp
                    {profile!.debt_limit.toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Payment promise required to submit.
                  </p>
                </div>
              )}

              <div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={priority === 'normal'}
                      onChange={() => setPriority('normal')}
                      className="mr-2"
                    />
                    Normal
                  </label>

                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={priority === 'cito'}
                      onChange={() => setPriority('cito')}
                      className="mr-2"
                    />
                    <span className="text-red-600 font-medium">
                      CITO (Urgent)
                    </span>
                  </label>
                </div>

                {priority === 'cito' && (
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full mt-4 border rounded-lg p-2"
                    placeholder="Reason..."
                  />
                )}

                {hasDebtIssue && (
                  <div className="mt-6">
                    <input
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                      className="w-full border rounded-lg p-2 mb-2"
                      required
                    />

                    <textarea
                      value={paymentNote}
                      onChange={(e) =>
                        setPaymentNote(e.target.value)
                      }
                      className="w-full border rounded-lg p-2"
                      placeholder="Payment note..."
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || total === 0}
              className="w-full bg-black text-white py-3 rounded-lg"
            >
              {submitting
                ? 'Submitting...'
                : `Submit Request (${total} items)`}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
