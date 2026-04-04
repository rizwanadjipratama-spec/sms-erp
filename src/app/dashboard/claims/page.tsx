'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { canAccessRoute } from '@/lib/permissions';
import { claimService, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { supabase } from '@/lib/supabase';
import type { CompanyRequest, CompanyRequestItem, CompanyRequestType, PaymentPreferenceType, UserPaymentMethod } from '@/types/types';

// Format currency
const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
  READY_FOR_CASH: 'bg-green-50 text-green-700 border-green-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  PENDING: 'Pending',
  READY_FOR_CASH: 'Siap Diambil',
  COMPLETED: 'Selesai',
};

// Empty line item
const emptyItem = (): Omit<CompanyRequestItem, 'id' | 'request_id' | 'created_at'> => ({
  description: '',
  unit: 'pcs',
  quantity: 1,
  price_per_unit: 0,
  total_price: 0,
  receipt_url: '',
});

export default function ClaimsDashboard() {
  const { profile, role, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();

  const [tab, setTab] = useState<'CLAIM' | 'REQUISITION'>('CLAIM');
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<CompanyRequestType>('CLAIM');
  const [paymentPref, setPaymentPref] = useState<PaymentPreferenceType>('CASH');
  const [paymentPrefDetails, setPaymentPrefDetails] = useState('');
  const [items, setItems] = useState<Omit<CompanyRequestItem, 'id' | 'request_id' | 'created_at'>[]>([emptyItem()]);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<UserPaymentMethod[]>([]);

  // Expanded request detail
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/claims')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const getActor = useCallback(async (): Promise<{ id: string; email: string | undefined; role: string }> => {
    const user = await requireAuthUser();
    return { id: user.id, email: user.email ?? profile?.email, role: role ?? '' };
  }, [profile, role]);

  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await claimService.getRequests({ created_by: profile?.id });
      setRequests(data);
      
      if (profile?.id) {
        const { data: methods } = await supabase.from('user_payment_methods').select('*').eq('user_id', profile.id);
        if (methods) setPaymentMethods(methods as UserPaymentMethod[]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load requests');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  const filteredRequests = useMemo(() =>
    requests.filter(r => r.type === tab),
  [requests, tab]);

  // Item management
  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      if (field === 'quantity' || field === 'price_per_unit') {
        updated[index].total_price = updated[index].quantity * updated[index].price_per_unit;
      }
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const totalAmount = useMemo(() =>
    items.reduce((sum, item) => sum + (item.total_price || 0), 0),
  [items]);

  // Receipt upload
  const uploadReceipt = async (file: File): Promise<string> => {
    const fileName = `receipts/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('company-assets').upload(fileName, file);
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!profile || submitting) return;
    if (activeBranchId === 'ALL') return alert('Pilih cabang spesifik sebelum submit.');
    if (items.some(i => !i.description.trim())) return alert('Semua item harus ada deskripsi.');
    if (items.some(i => i.total_price <= 0)) return alert('Harga item harus lebih dari 0.');
    if (paymentPref === 'TRANSFER' && (!paymentPrefDetails || paymentPrefDetails.trim() === '')) return alert('Pilih rekening transfer Anda.');
    if (paymentPref === 'OTHERS' && (!paymentPrefDetails || paymentPrefDetails.trim() === '')) return alert('Pilih atau isi e-wallet/metode Anda.');

    setSubmitting(true);
    try {
      const actor = await getActor();
      await claimService.createRequest(
        {
          type: formType,
          branch_id: activeBranchId,
          payment_preference: paymentPref,
          payment_preference_details: paymentPrefDetails,
          items: items as any,
          note: submissionNote,
        },
        actor as any
      );
      setShowForm(false);
      setItems([emptyItem()]);
      setSubmissionNote('');
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Accept Ready Cash / Complete claim
  const handleCompleteClaim = async (requestId: string) => {
    try {
      const actor = await getActor();
      await claimService.completeClaim(requestId, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Complete claim failed');
    }
  };

  // Accept negotiated payment method
  const handleAcceptNegotiation = async (requestId: string) => {
    try {
      const actor = await getActor();
      await claimService.completeClaim(requestId, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Accept failed');
    }
  };

  // Reject negotiated payment method
  const handleRejectNegotiation = async (requestId: string) => {
    const reason = prompt('Alasan menolak metode bayar?');
    if (!reason) return;
    try {
      const actor = await getActor();
      await claimService.rejectNegotiation(requestId, reason, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Reject failed');
    }
  };

  // Accept Partial Proposal
  const handleAcceptPartial = async (requestId: string, req: CompanyRequest) => {
    try {
      const actor = await getActor();
      await claimService.acceptPartialProposal(requestId, req, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Accept failed');
    }
  };

  // Reject Partial Proposal
  const handleRejectPartial = async (requestId: string) => {
    const reason = prompt('Alasan menolak pencairan sebagian? (misal: mau tunggu full aja)');
    if (!reason) return;
    try {
      const actor = await getActor();
      await claimService.rejectPartialProposal(requestId, reason, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Reject failed');
    }
  };

  if (loading || (fetching && requests.length === 0)) {
    return <div className="max-w-5xl mx-auto p-4"><DashboardSkeleton /></div>;
  }
  if (error && requests.length === 0) {
    return <div className="max-w-5xl mx-auto p-4"><ErrorState message={error} onRetry={refresh} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Claims & Requests</h1>
          <p className="text-apple-text-secondary text-sm font-medium mt-1">Ajukan klaim (reimburse) atau pengajuan pembelian barang.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormType(tab); }}
          className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue-hover text-white text-xs font-bold px-5 py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-apple-blue/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {tab === 'CLAIM' ? 'Buat Klaim Baru' : 'Buat Pengajuan Baru'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-apple-gray-bg rounded-xl p-1 border border-apple-gray-border w-fit">
        {(['CLAIM', 'REQUISITION'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setFormType(t); }}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-white text-apple-text-primary shadow-sm' : 'text-apple-text-secondary hover:text-apple-text-primary'}`}
          >
            {t === 'CLAIM' ? '💰 Klaim (Reimburse)' : '📋 Pengajuan Barang'}
          </button>
        ))}
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-6 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-black uppercase tracking-widest text-apple-text-primary">
            {formType === 'CLAIM' ? '💰 Klaim Baru' : '📋 Pengajuan Baru'}
          </h2>

          {/* Payment Preference */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2">
              Metode Pembayaran yang Diinginkan
            </label>
            <div className="flex gap-3 flex-wrap">
              {(['CASH', 'TRANSFER', 'OTHERS'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPaymentPref(p)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${paymentPref === p ? 'bg-apple-blue text-white border-apple-blue' : 'bg-apple-gray-bg text-apple-text-secondary border-apple-gray-border hover:border-apple-blue/40'}`}
                >
                  {p === 'CASH' ? '💵 Cash' : p === 'TRANSFER' ? '🏦 Transfer' : '📝 E-Wallet / Lainnya'}
                </button>
              ))}
            </div>

            {paymentPref === 'TRANSFER' && (
              <div className="mt-3">
                {paymentMethods.filter(m => m.type === 'BANK').length > 0 ? (
                  <select 
                    value={paymentMethods.some(m => m.type === 'BANK' && `${m.provider} - ${m.account_number} a/n ${m.account_name}` === paymentPrefDetails) ? paymentPrefDetails : ''}
                    onChange={e => setPaymentPrefDetails(e.target.value)}
                    className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all"
                  >
                    <option value="" disabled>Pilih Rekening Bank...</option>
                    {paymentMethods.filter(m => m.type === 'BANK').map(m => (
                      <option key={m.id} value={`${m.provider} - ${m.account_number} a/n ${m.account_name}`}>
                        {m.provider} - {m.account_number} ({m.account_name})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100 flex items-center justify-between">
                    <span>Belum ada Rekening Bank tersimpan.</span>
                    <a href="/dashboard/profile" className="font-bold underline">Tambah di Profile</a>
                  </div>
                )}
              </div>
            )}

            {paymentPref === 'OTHERS' && (
              <div className="mt-3 space-y-2">
                {paymentMethods.filter(m => m.type === 'EWALLET').length > 0 && (
                  <select 
                    value={paymentMethods.some(m => m.type === 'EWALLET' && `${m.provider} - ${m.account_number} a/n ${m.account_name}` === paymentPrefDetails) ? paymentPrefDetails : ''}
                    onChange={e => setPaymentPrefDetails(e.target.value)}
                    className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all"
                  >
                    <option value="" disabled>Pilih E-Wallet Tersimpan...</option>
                    {paymentMethods.filter(m => m.type === 'EWALLET').map(m => (
                      <option key={m.id} value={`${m.provider} - ${m.account_number} a/n ${m.account_name}`}>
                        {m.provider} - {m.account_number} ({m.account_name})
                      </option>
                    ))}
                  </select>
                )}
                
                <input
                  type="text"
                  placeholder="Atau isi manual (e.g. Dana 081234... / Kasir Toko)..."
                  value={(!paymentMethods.some(m => m.type === 'EWALLET' && `${m.provider} - ${m.account_number} a/n ${m.account_name}` === paymentPrefDetails)) ? paymentPrefDetails : ''}
                  onChange={e => setPaymentPrefDetails(e.target.value)}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">Items</label>
              <button onClick={addItem} className="text-xs font-bold text-apple-blue hover:underline">+ Tambah Item</button>
            </div>

            {items.map((item, i) => (
              <div key={i} className="bg-apple-gray-bg rounded-xl p-4 space-y-3 border border-apple-gray-border relative">
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                )}
                <input
                  type="text"
                  placeholder="Deskripsi item (e.g. Bensin Pertamax ke Bogor)"
                  value={item.description}
                  onChange={e => updateItem(i, 'description', e.target.value)}
                  className="w-full bg-white border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-apple-text-secondary mb-1 block">Unit</label>
                    <select
                      value={item.unit}
                      onChange={e => updateItem(i, 'unit', e.target.value)}
                      className="w-full bg-white border border-apple-gray-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-apple-blue/10 outline-none"
                    >
                      <option value="pcs">Pcs</option>
                      <option value="liter">Liter</option>
                      <option value="unit">Unit</option>
                      <option value="box">Box</option>
                      <option value="set">Set</option>
                      <option value="pack">Pack</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-apple-text-secondary mb-1 block">Qty</label>
                    <input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} className="w-full bg-white border border-apple-gray-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-apple-blue/10 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-apple-text-secondary mb-1 block">Harga/Unit</label>
                    <input type="number" min={0} value={item.price_per_unit} onChange={e => updateItem(i, 'price_per_unit', Number(e.target.value))} className="w-full bg-white border border-apple-gray-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-apple-blue/10 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-apple-text-secondary mb-1 block">Total</label>
                    <div className="bg-white border border-apple-gray-border rounded-lg px-3 py-2 text-xs font-bold text-apple-text-primary">{fmt(item.total_price)}</div>
                  </div>
                </div>
                {/* Receipt upload for Claims */}
                {formType === 'CLAIM' && (
                  <div>
                    <label className="text-[9px] font-bold uppercase text-apple-text-secondary mb-1 block">Foto Bon / Receipt *</label>
                    {item.receipt_url ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-bold">✓ Uploaded</span>
                        <button onClick={() => updateItem(i, 'receipt_url', '')} className="text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadReceipt(file);
                            updateItem(i, 'receipt_url', url);
                          } catch (err: any) {
                            alert(err?.message || 'Upload failed');
                          }
                        }}
                        className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-apple-blue/10 file:text-apple-blue hover:file:bg-apple-blue/20 transition-all"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submission Note */}
          <div>
            <label className="text-[9px] font-bold uppercase text-apple-text-secondary mb-1 block">Catatan untuk Claim Officer (Opsional)</label>
            <textarea
              placeholder="Contoh: Tolong proses cepet ya bro, uangnya dipake besok."
              value={submissionNote}
              onChange={e => setSubmissionNote(e.target.value)}
              className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all resize-y min-h-[80px]"
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-gradient-to-r from-apple-blue/5 to-apple-blue/10 rounded-xl px-6 py-4 border border-apple-blue/20">
            <span className="text-sm font-bold text-apple-text-secondary">GRAND TOTAL</span>
            <span className="text-2xl font-black text-apple-blue">{fmt(totalAmount)}</span>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-5 py-3 rounded-xl text-xs font-bold text-apple-text-secondary bg-apple-gray-bg border border-apple-gray-border hover:bg-gray-100 transition-all">Batal</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || totalAmount <= 0}
              className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-apple-blue hover:bg-apple-blue-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-apple-blue/20 active:scale-[0.98]"
            >
              {submitting ? 'Submitting...' : 'Submit untuk Approval'}
            </button>
          </div>
        </div>
      )}

      {/* Request List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 && !fetching && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">{tab === 'CLAIM' ? '💰' : '📋'}</div>
            <p className="text-apple-text-secondary font-medium">Belum ada {tab === 'CLAIM' ? 'klaim' : 'pengajuan'}.</p>
          </div>
        )}

        {filteredRequests.map(req => (
          <div key={req.id} className="bg-white rounded-2xl border border-apple-gray-border shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Summary Row */}
            <button
              onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
              className="w-full flex items-center gap-4 p-5 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${STATUS_COLORS[req.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                  <span className="text-[10px] text-apple-text-secondary font-medium">{new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <p className="text-sm font-bold text-apple-text-primary truncate">
                  {req.items && req.items.length > 0 ? req.items.map(i => i.description).join(', ') : 'No items'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-apple-text-primary">{fmt(req.total_amount)}</p>
                {req.paid_amount > 0 && req.paid_amount < req.total_amount && (
                  <>
                    <p className="text-[10px] font-bold text-green-600">Dibayar: {fmt(req.paid_amount)}</p>
                    <p className="text-[10px] font-bold text-orange-600 mt-1">Sisa: {fmt(req.total_amount - req.paid_amount)}</p>
                  </>
                )}
              </div>
              <svg className={`w-4 h-4 text-apple-text-secondary transition-transform ${expandedId === req.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* Expanded Details */}
            {expandedId === req.id && (
              <div className="border-t border-apple-gray-border px-5 py-4 space-y-4 bg-apple-gray-bg/50 animate-in slide-in-from-top-2 duration-200">
                {/* Items */}
                <div className="space-y-2">
                  {req.items?.map((item, i) => (
                    <div key={item.id || i} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-apple-gray-border">
                      <span className="font-medium text-apple-text-primary">{item.description}</span>
                      <span className="font-bold text-apple-text-primary">{item.quantity} {item.unit} × {fmt(item.price_per_unit)} = {fmt(item.total_price)}</span>
                    </div>
                  ))}
                </div>

                {/* Approval Info */}
                {req.approval_note && (
                  <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs border border-blue-100">
                    <span className="font-bold text-blue-700">Catatan Approval:</span> <span className="text-blue-600">{req.approval_note}</span>
                  </div>
                )}
                {req.reject_reason && (
                  <div className="bg-red-50 rounded-lg px-4 py-3 text-xs border border-red-100">
                    <span className="font-bold text-red-700">Alasan Ditolak:</span> <span className="text-red-600">{req.reject_reason}</span>
                  </div>
                )}
                {req.pending_reason && (
                  <div className="bg-orange-50 rounded-lg px-4 py-3 text-xs border border-orange-100">
                    <span className="font-bold text-orange-700">Status Pending:</span> <span className="text-orange-600">{req.pending_reason}</span>
                  </div>
                )}

                {/* Ready for Cash banner */}
                {req.status === 'READY_FOR_CASH' && (
                  <div className="bg-green-50 rounded-xl px-4 py-4 border border-green-200 space-y-3">
                    <p className="text-sm font-bold text-green-700">✅ Uang sudah siap! Tolong berikan bon fisik ke Claim Officer saat mengambil uang.</p>
                    <button
                      onClick={() => handleCompleteClaim(req.id)}
                      className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all"
                    >
                      Sudah Diambil (Claimed)
                    </button>
                  </div>
                )}

                {/* Partial Proposal Negotiation */}
                {req.status === 'PENDING' && (req.proposed_amount || 0) > 0 && (
                  <div className="bg-amber-50 rounded-xl px-4 py-4 border border-amber-200 space-y-3">
                    <p className="text-sm font-bold text-amber-700">
                      ⚠️ Claim Officer menawarkan pencairan sebagian sebesar <span className="font-black">{fmt(req.proposed_amount || 0)}</span>. Ambil sekarang atau tunggu uang komplit?
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => handleAcceptPartial(req.id, req)} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all">Ambil Sebagian</button>
                      <button onClick={() => handleRejectPartial(req.id)} className="px-4 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all">Tolak (Tunggu Full)</button>
                    </div>
                  </div>
                )}

                {/* Method Negotiation */}
                {req.status === 'PENDING' && req.payment_method_offered && req.payment_method_offered !== req.payment_preference && (
                  <div className="bg-amber-50 rounded-xl px-4 py-4 border border-amber-200 space-y-3">
                    <p className="text-sm font-bold text-amber-700">
                      ⚠️ Claim Officer menawarkan pembayaran via <span className="uppercase">{req.payment_method_offered}</span> (Kamu minta <span className="uppercase">{req.payment_preference}</span>)
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => handleAcceptNegotiation(req.id)} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all">Terima</button>
                      <button onClick={() => handleRejectNegotiation(req.id)} className="px-4 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all">Tolak</button>
                    </div>
                  </div>
                )}

                {/* Post-Claim Issue */}
                {req.post_claim_issue && (
                  <div className="bg-red-50 rounded-lg px-4 py-3 text-xs border border-red-200">
                    <span className="font-bold text-red-700">⚠️ Issue:</span> <span className="text-red-600">{req.post_claim_issue}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
