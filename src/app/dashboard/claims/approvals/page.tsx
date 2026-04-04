'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { canAccessRoute } from '@/lib/permissions';
import { claimService, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { CompanyRequest } from '@/types/types';

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function ClaimApprovalsDashboard() {
  const { profile, role, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();

  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedReq, setSelectedReq] = useState<CompanyRequest | null>(null);
  const [modalMode, setModalMode] = useState<'approve' | 'reject' | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/claims/approvals')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const getActor = useCallback(async () => {
    const user = await requireAuthUser();
    return { id: user.id, email: user.email ?? profile?.email, role: role ?? '' };
  }, [profile, role]);

  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await claimService.getRequests({ status: 'SUBMITTED', branch_id: activeBranchId });
      setRequests(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setFetching(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  const handleApprove = async () => {
    if (!selectedReq || processing) return;
    setProcessing(true);
    try {
      const actor = await getActor();
      await claimService.approveRequest(selectedReq.id, modalNote || undefined, actor as any);
      setModalMode(null);
      setSelectedReq(null);
      setModalNote('');
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Approval failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq || !modalNote.trim() || processing) return;
    setProcessing(true);
    try {
      const actor = await getActor();
      await claimService.rejectRequest(selectedReq.id, modalNote, actor as any);
      setModalMode(null);
      setSelectedReq(null);
      setModalNote('');
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Rejection failed');
    } finally {
      setProcessing(false);
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
      <div>
        <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Claim Approvals</h1>
        <p className="text-apple-text-secondary text-sm font-medium mt-1">Review dan approve/reject klaim & pengajuan dari karyawan.</p>
      </div>

      {requests.length === 0 && !fetching && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-apple-text-secondary font-medium">Semua request sudah di-review. Tidak ada yang menunggu approval.</p>
        </div>
      )}

      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 space-y-4 transition-all hover:shadow-md">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${req.type === 'CLAIM' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                    {req.type === 'CLAIM' ? '💰 Klaim' : '📋 Pengajuan'}
                  </span>
                  <span className="text-[10px] text-apple-text-secondary font-medium">
                    {new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-bold text-apple-text-primary">
                  Dari: {req.creator?.name || req.created_by}
                </p>
                <p className="text-xs font-medium text-apple-text-secondary mt-0.5">
                  Bayar via: <span className="uppercase font-bold">{req.payment_preference}</span>
                  {req.payment_preference_details && ` (${req.payment_preference_details})`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-apple-text-primary">{fmt(req.total_amount)}</p>
                <p className="text-[10px] font-bold text-apple-text-secondary">{req.items?.length || 0} items</p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1.5">
              {req.items?.map((item, i) => (
                <div key={item.id || i} className="flex items-center justify-between text-xs bg-apple-gray-bg rounded-lg px-3 py-2 border border-apple-gray-border">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-apple-text-primary">{item.description}</span>
                    {item.receipt_url && (
                      <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-apple-blue hover:underline font-bold">📷 Bon</a>
                    )}
                  </div>
                  <span className="font-bold text-apple-text-primary">{item.quantity} {item.unit} × {fmt(item.price_per_unit)} = {fmt(item.total_price)}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-apple-gray-border">
              <button
                onClick={() => { setSelectedReq(req); setModalMode('approve'); setModalNote(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all active:scale-[0.98]"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => { setSelectedReq(req); setModalMode('reject'); setModalNote(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all active:scale-[0.98]"
              >
                ✗ Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Overlay */}
      {modalMode && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black text-apple-text-primary">
              {modalMode === 'approve' ? '✓ Approve Request' : '✗ Reject Request'}
            </h3>
            <p className="text-sm text-apple-text-secondary">
              {selectedReq.type === 'CLAIM' ? 'Klaim' : 'Pengajuan'} sebesar <span className="font-bold text-apple-text-primary">{fmt(selectedReq.total_amount)}</span> dari <span className="font-bold">{selectedReq.creator?.name}</span>
            </p>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2">
                {modalMode === 'approve' ? 'Catatan (Opsional)' : 'Alasan Penolakan (Wajib)'}
              </label>
              <textarea
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                rows={3}
                placeholder={modalMode === 'approve' ? 'Contoh: ACC, tapi lain kali yg jelas ya foto bonnya...' : 'Contoh: Bonnya keliatan palsu / tidak masuk akal...'}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setModalMode(null); setSelectedReq(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-apple-text-secondary bg-apple-gray-bg border border-apple-gray-border hover:bg-gray-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={modalMode === 'approve' ? handleApprove : handleReject}
                disabled={processing || (modalMode === 'reject' && !modalNote.trim())}
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${modalMode === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {processing ? 'Processing...' : modalMode === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
