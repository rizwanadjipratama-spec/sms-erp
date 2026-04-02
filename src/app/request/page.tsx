'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRequest } from '@/lib/request-context';
import Link from 'next/link';
import { productService } from '@/lib/services';
import { Product } from '@/types/types';
import { formatCurrency } from '@/lib/format-utils';
import { supabase } from '@/lib/db/client';

const CITO_MONTHLY_LIMIT = 4;

export default function RequestPage() {
  const { profile, loading } = useAuth();
  const { items, submit, updateQty, remove } = useRequest();

  const [submitting, setSubmitting] = useState(false);
  const [priority, setPriority] = useState<'normal' | 'cito'>('normal');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('Laboratory');
  const [customDestination, setCustomDestination] = useState('');
  const [floor, setFloor] = useState('1');
  const [customFloor, setCustomFloor] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [citoUsed, setCitoUsed] = useState(0);
  const citoRemaining = CITO_MONTHLY_LIMIT - citoUsed;
  const citoExhausted = citoRemaining <= 0;

  const router = useRouter();

  useEffect(() => {
    productService.getActive()
      .then((data) => {
        setProducts(data);
        setProductsLoading(false);
      })
      .catch(() => setProductsLoading(false));
  }, []);

  // Fetch CITO usage for this month
  useEffect(() => {
    if (!profile?.id) return;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('priority', 'cito')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)
      .then(({ count }) => {
        setCitoUsed(count || 0);
      });
  }, [profile?.id]);

  const total = items.reduce((acc, item) => acc + (item.qty || 0), 0);
  const hasDebtIssue = (profile?.debt_amount || 0) > (profile?.debt_limit || 0);

  const clientType = profile?.client_type?.toLowerCase() || 'regular';
  const isNoPriceUser = clientType === 'cost per test' || clientType === 'cost_per_test';

  const getUnitPrice = (prod: Product | undefined): number => {
    if (!prod?.price) return 0;
    if (clientType === 'kso') return prod.price.price_kso || 0;
    return prod.price.price_regular || 0;
  };

  const totalPriceValue = items.reduce((acc, item) => {
    const prod = products.find(p => p.id === item.id);
    return acc + (getUnitPrice(prod) * item.qty);
  }, 0);

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

  // Block request submission if client has not completed their profile
  if (profile.role === 'client' && !profile.profile_completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-bg px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-apple-gray-border">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5 text-2xl">⚠️</div>
          <h2 className="text-2xl font-black text-apple-text-primary mb-4">Complete Your Profile First</h2>
          <p className="text-apple-text-secondary mb-8 font-medium">
            You need to fill in your institution details before you can submit a request.
          </p>
          <Link
            href="/dashboard/profile"
            className="inline-block bg-apple-text-primary text-white py-3 px-8 rounded-apple font-bold hover:bg-black transition active:scale-95"
          >
            Go to My Profile
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
      const finalDest = destination === 'Other' ? (customDestination || 'Other') : destination;
      const finalFlr = floor === 'Other' ? (customFloor || 'Other') : floor;
      let finalNote = `Destination: ${finalDest}, Floor: ${finalFlr}`;
      if (reason) finalNote += `\n\nUrgency Reason:\n${reason}`;

      await submit({
        priority,
        note: finalNote,
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

  const getProduct = (id: string) => {
    return products.find((p) => p.id === id);
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
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors text-apple-text-secondary hover:text-apple-text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">New Request</h1>
            </div>
            <p className="text-apple-text-secondary mt-2 font-medium">
              Review your items and system requirements.
              {profile?.client_type === 'kso' && (
                <span className="ml-2 inline-flex items-center rounded-full bg-apple-blue/10 px-2 py-0.5 text-[10px] font-bold text-apple-blue">KSO</span>
              )}
              {profile?.client_type === 'cost_per_test' && (
                <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Cost Per Test</span>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 sm:p-12">
            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">Cart Summary</h3>
                <div className="space-y-4">
                  {items.map((item) => {
                    const prod = getProduct(item.id);
                    const name = prod?.name || item.id;
                    const price = getUnitPrice(prod);
                    const subtotal = price * item.qty;

                    return (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-apple-gray-bg border border-apple-gray-border rounded-xl gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-apple-text-primary line-clamp-2">{name}</p>
                          {!isNoPriceUser && price > 0 && (
                            <p className="text-xs text-apple-text-secondary mt-1 tracking-wide">
                              {formatCurrency(price)} <span className="text-[10px]">/ unit</span>
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-white border border-apple-gray-border rounded-lg shadow-sm">
                            <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} className="px-3 py-1.5 text-apple-text-secondary hover:text-red-500 font-black transition-colors rounded-l-lg hover:bg-gray-50">-</button>
                            <span className="px-3 py-1.5 text-xs font-bold text-apple-text-primary min-w-[2.5rem] border-x border-apple-gray-border text-center">{item.qty}</span>
                            <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} className="px-3 py-1.5 text-apple-text-secondary hover:text-apple-blue font-black transition-colors rounded-r-lg hover:bg-gray-50">+</button>
                          </div>
                          <button type="button" onClick={() => remove(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                        
                        {!isNoPriceUser && price > 0 && (
                          <div className="w-24 text-right">
                            <p className="text-sm font-black text-apple-text-primary">{formatCurrency(subtotal)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="pt-6 border-t border-apple-gray-border flex flex-col gap-2">
                  <div className="flex justify-between items-center font-black text-lg">
                    <span className="text-apple-text-primary">Total items</span>
                    <span className="text-apple-blue">{total}</span>
                  </div>
                  {!isNoPriceUser && totalPriceValue > 0 && (
                    <div className="flex justify-between items-center font-black text-xl text-apple-text-primary mt-2">
                      <span>Total Price</span>
                      <span>{formatCurrency(totalPriceValue)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4 font-bold text-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-4">Destination</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-apple-text-secondary">Location</label>
                      <select value={destination} onChange={e => setDestination(e.target.value)} className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-bold bg-white focus:ring-4 focus:ring-apple-blue/10 outline-none">
                        <option value="Laboratory">Laboratory</option>
                        <option value="Warehouse">Warehouse</option>
                        <option value="Front Desk">Front Desk</option>
                        <option value="Other">Other</option>
                      </select>
                      {destination === 'Other' && (
                        <input type="text" value={customDestination} onChange={e => setCustomDestination(e.target.value)} placeholder="Specify location..." required className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-medium bg-white focus:ring-4 focus:ring-apple-blue/10 outline-none mt-2" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-apple-text-secondary">Floor</label>
                      <select value={floor} onChange={e => setFloor(e.target.value)} className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-bold bg-white focus:ring-4 focus:ring-apple-blue/10 outline-none">
                        <option value="1">1st Floor</option>
                        <option value="2">2nd Floor</option>
                        <option value="3">3rd Floor</option>
                        <option value="4">4th Floor</option>
                        <option value="5">5th Floor</option>
                        <option value="Other">Other</option>
                      </select>
                      {floor === 'Other' && (
                        <input type="text" value={customFloor} onChange={e => setCustomFloor(e.target.value)} placeholder="Specify floor..." required className="w-full border border-apple-gray-border rounded-xl p-3 text-sm font-medium bg-white focus:ring-4 focus:ring-apple-blue/10 outline-none mt-2" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 font-bold text-sm pt-4 border-t border-apple-gray-border">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-4">Priority Level</h3>
                  <label className="flex items-center gap-3 p-3 rounded-apple bg-apple-gray-bg border border-apple-gray-border cursor-pointer group transition-all">
                    <input type="radio" checked={priority === 'normal'} onChange={() => setPriority('normal')} className="w-4 h-4 text-apple-blue focus:ring-apple-blue" />
                    <span className="text-apple-text-primary group-hover:text-apple-blue transition-colors">Normal</span>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-apple border cursor-pointer group transition-all ${
                    citoExhausted
                      ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-apple-gray-bg border-apple-gray-border'
                  }`}>
                    <input type="radio" checked={priority === 'cito'} onChange={() => !citoExhausted && setPriority('cito')} disabled={citoExhausted} className="w-4 h-4 text-apple-danger focus:ring-apple-danger disabled:opacity-50" />
                    <div className="flex-1">
                      <span className={citoExhausted ? 'text-gray-400' : 'text-apple-danger'}>CITO (Urgent)</span>
                      <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        citoExhausted
                          ? 'bg-red-100 text-red-500'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {citoRemaining}/{CITO_MONTHLY_LIMIT} remaining
                      </span>
                    </div>
                  </label>
                  {citoExhausted && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                      <p className="text-xs text-red-600 font-bold">⚠️ Kuota CITO bulan ini sudah habis ({CITO_MONTHLY_LIMIT}x/bulan). Silakan gunakan prioritas Normal atau hubungi tim kami jika benar-benar darurat.</p>
                      <div className="pt-2 border-t border-red-200">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">💡 Tips Menghindari Pesanan Darurat:</p>
                        <ul className="text-[10px] text-red-600/80 space-y-1.5 list-none">
                          <li>📦 Pantau stok secara rutin — segera lakukan request ulang saat stok mulai menipis agar tidak sampai kehabisan total.</li>
                          <li>📅 Buat jadwal pemesanan berkala (mingguan/bulanan) agar kebutuhan selalu terpenuhi tepat waktu.</li>
                          <li>📊 Catat pola pemakaian alat & reagent Anda, agar bisa memprediksi kapan harus restock.</li>
                          <li>🤝 Koordinasi dengan tim gudang/lab untuk mengetahui kebutuhan sebelum benar-benar habis.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  {!citoExhausted && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                      <p className="text-[10px] text-amber-700 leading-relaxed">
                        ⚡ Mohon gunakan CITO hanya untuk kebutuhan yang <strong>benar-benar mendesak</strong>. Kuota CITO dibatasi <strong>{CITO_MONTHLY_LIMIT}x per bulan</strong> agar permintaan darurat yang sebenarnya dapat ditangani dengan cepat tanpa terhambat.
                      </p>
                      <p className="text-[10px] text-amber-600/80 leading-relaxed">
                        💡 <strong>Tip:</strong> Pantau stok Anda secara berkala dan segera ajukan request baru jika stok mulai menipis. Perencanaan yang baik akan mengurangi kebutuhan darurat dan memastikan operasional laboratorium Anda berjalan lancar.
                      </p>
                    </div>
                  )}
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

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-apple font-black text-sm hover:bg-gray-50 transition-all active:scale-95"
              >
                ← BACK
              </button>
              <button
                type="submit"
                disabled={submitting || total === 0}
                className="flex-[2] bg-apple-text-primary text-white py-4 rounded-apple font-black text-sm hover:bg-black transition-all active:scale-95 shadow-2xl shadow-black/20 disabled:opacity-50"
              >
                {submitting ? 'SUBMITTING...' : `SUBMIT REQUEST (${total} ITEMS)`}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
