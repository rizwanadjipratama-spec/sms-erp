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
import type { CompanyRequest, PaymentPreferenceType } from '@/types/types';

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const PENDING_REASONS = [
  { label: 'Uang Belum Ada', value: 'uang_belum_ada' },
  { label: 'Menunggu Transfer (Perlu ke ATM)', value: 'menunggu_transfer' },
  { label: 'Bon Belum Lengkap', value: 'bon_belum_lengkap' },
  { label: 'Lainnya', value: 'other' },
];

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
  READY_FOR_CASH: 'bg-green-50 text-green-700 border-green-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function DisbursementsDashboard() {
  const { profile, role, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();

  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPendingReason, setFilterPendingReason] = useState<string>('ALL');

  // Disbursement modal
  const [selectedReq, setSelectedReq] = useState<CompanyRequest | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentPreferenceType>('CASH');
  const [pendingReason, setPendingReason] = useState('');
  const [customPendingReason, setCustomPendingReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Issue modal
  const [issueReq, setIssueReq] = useState<CompanyRequest | null>(null);
  const [issueNote, setIssueNote] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/claims/disbursements')) {
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
      const data = await claimService.getRequests({
        status: ['APPROVED', 'PENDING', 'READY_FOR_CASH', 'COMPLETED'],
        branch_id: activeBranchId
      });
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

  const filtered = requests.filter(r => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterPendingReason !== 'ALL' && r.status === 'PENDING') {
      if (!r.pending_reason?.includes(filterPendingReason)) return false;
    }
    return true;
  });

  // Process disbursement
  const handleDisburse = async () => {
    if (!selectedReq || processing) return;
    const reason = pendingReason === 'other' ? customPendingReason : pendingReason;
    setProcessing(true);
    try {
      const actor = await getActor();
      await claimService.processDisbursement(
        selectedReq.id,
        selectedReq,
        { pay_amount: payAmount, payment_method_used: payMethod, pending_reason: reason || undefined },
        actor as any
      );
      setSelectedReq(null);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Disbursement failed');
    } finally {
      setProcessing(false);
    }
  };

  // Mark transfer done
  const handleTransferDone = async (id: string) => {
    try {
      const actor = await getActor();
      await claimService.markTransferDone(id, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed');
    }
  };

  // Complete claim directly
  const handleComplete = async (id: string) => {
    try {
      const actor = await getActor();
      await claimService.completeClaim(id, actor as any);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed');
    }
  };

  // Flag issue
  const handleFlagIssue = async () => {
    if (!issueReq || !issueNote.trim()) return;
    try {
      const actor = await getActor();
      await claimService.flagPostClaimIssue(issueReq.id, issueNote, actor as any);
      setIssueReq(null);
      setIssueNote('');
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed');
    }
  };

  // Print
  const handlePrint = (req: CompanyRequest) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Popup blocked!');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${req.type === 'CLAIM' ? 'Klaim' : 'Pengajuan'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1d1d1f; }
          .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #e5e5e7; padding-bottom: 24px; }
          .header h1 { font-size: 20px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
          .header p { font-size: 11px; color: #86868b; margin-top: 4px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; font-size: 12px; }
          .meta .label { color: #86868b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 9px; }
          .meta .value { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f5f5f7; text-align: left; padding: 10px 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #86868b; border-bottom: 2px solid #e5e5e7; }
          td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e5e5e7; }
          .total-row { background: #f5f5f7; }
          .total-row td { font-weight: 800; font-size: 14px; }
          .footer { text-align: center; margin-top: 48px; font-size: 10px; color: #86868b; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 64px; text-align: center; font-size: 10px; }
          .sig-line { border-top: 1px solid #1d1d1f; margin-top: 64px; padding-top: 8px; font-weight: 700; }
          @media print { body { padding: 20px; } @page { margin: 1cm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SMS Laboratory Systems</h1>
          <p>${req.type === 'CLAIM' ? 'Bukti Klaim (Reimbursement)' : 'Bukti Pengajuan Pembelian'}</p>
        </div>
        <div class="meta">
          <div><div class="label">Nama Pengaju</div><div class="value">${req.creator?.name || '-'}</div></div>
          <div><div class="label">Tanggal</div><div class="value">${new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
          <div><div class="label">Metode Bayar</div><div class="value">${req.payment_preference}</div></div>
          <div><div class="label">Status</div><div class="value">${req.status}</div></div>
        </div>
        <table>
          <thead><tr><th>No</th><th>Deskripsi</th><th>Unit</th><th>Qty</th><th>Harga/Unit</th><th>Total</th></tr></thead>
          <tbody>
            ${(req.items || []).map((item, i) => `
              <tr><td>${i + 1}</td><td>${item.description}</td><td>${item.unit || '-'}</td><td>${item.quantity}</td><td>Rp ${item.price_per_unit.toLocaleString('id-ID')}</td><td>Rp ${item.total_price.toLocaleString('id-ID')}</td></tr>
            `).join('')}
            <tr class="total-row"><td colspan="5" style="text-align:right;">GRAND TOTAL</td><td>Rp ${req.total_amount.toLocaleString('id-ID')}</td></tr>
          </tbody>
        </table>
        <div class="signatures">
          <div><div class="sig-line">Pengaju</div></div>
          <div><div class="sig-line">Claim Officer</div></div>
          <div><div class="sig-line">Approved By</div></div>
        </div>
        <div class="footer">Dicetak pada ${new Date().toLocaleString('id-ID')} — SMS ERP System</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading || (fetching && requests.length === 0)) {
    return <div className="max-w-6xl mx-auto p-4"><DashboardSkeleton /></div>;
  }
  if (error && requests.length === 0) {
    return <div className="max-w-6xl mx-auto p-4"><ErrorState message={error} onRetry={refresh} /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Disbursements</h1>
        <p className="text-apple-text-secondary text-sm font-medium mt-1">Kelola pencairan dana klaim & pengajuan yang sudah di-approve.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-apple-gray-border rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-apple-blue/10 outline-none appearance-none"
        >
          <option value="ALL">Semua Status</option>
          <option value="APPROVED">Approved (Belum Diproses)</option>
          <option value="PENDING">Pending</option>
          <option value="READY_FOR_CASH">Ready for Cash</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {filterStatus === 'PENDING' && (
          <select
            value={filterPendingReason}
            onChange={e => setFilterPendingReason(e.target.value)}
            className="bg-white border border-apple-gray-border rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-apple-blue/10 outline-none appearance-none"
          >
            <option value="ALL">Semua Alasan</option>
            {PENDING_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        )}
      </div>

      {/* Request Cards */}
      {filtered.length === 0 && !fetching && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-apple-text-secondary font-medium">Tidak ada request dengan filter ini.</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(req => {
          const balance = req.total_amount - (req.paid_amount || 0);
          return (
            <div key={req.id} className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 space-y-4 transition-all hover:shadow-md">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${STATUS_BADGE[req.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {req.status}
                    </span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${req.type === 'CLAIM' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                      {req.type}
                    </span>
                    <span className="text-[10px] text-apple-text-secondary font-medium">
                      {new Date(req.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-apple-text-primary">{req.creator?.name || '-'}</p>
                  <p className="text-xs text-apple-text-secondary mt-0.5">Mau bayar via: <span className="uppercase font-bold">{req.payment_preference}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-apple-text-primary">{fmt(req.total_amount)}</p>
                  {req.paid_amount > 0 && (
                    <p className="text-[10px] font-bold text-green-600">Dibayar: {fmt(req.paid_amount)}</p>
                  )}
                  {balance > 0 && req.paid_amount > 0 && (
                    <p className="text-[10px] font-bold text-orange-600">Sisa: {fmt(balance)}</p>
                  )}
                </div>
              </div>

              {/* Items preview */}
              <div className="space-y-1">
                {req.items?.map((item, i) => (
                  <div key={item.id || i} className="flex justify-between text-xs bg-apple-gray-bg rounded-lg px-3 py-2 border border-apple-gray-border">
                    <span className="font-medium">{item.description}</span>
                    <span className="font-bold">{fmt(item.total_price)}</span>
                  </div>
                ))}
              </div>

              {/* Pending reason */}
              {req.pending_reason && (
                <div className="bg-orange-50 rounded-lg px-4 py-2.5 text-xs border border-orange-100">
                  <span className="font-bold text-orange-700">Pending:</span> <span className="text-orange-600">{req.pending_reason}</span>
                </div>
              )}

              {/* Post-claim issue */}
              {req.post_claim_issue && (
                <div className="bg-red-50 rounded-lg px-4 py-2.5 text-xs border border-red-200">
                  <span className="font-bold text-red-700">⚠️ Issue:</span> <span className="text-red-600">{req.post_claim_issue}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-apple-gray-border">
                {/* Print always available */}
                <button
                  onClick={() => handlePrint(req)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-apple-text-secondary bg-apple-gray-bg border border-apple-gray-border hover:bg-gray-100 transition-all"
                >
                  🖨️ Print
                </button>

                {/* Disburse (for APPROVED or PENDING with balance) */}
                {(req.status === 'APPROVED' || (req.status === 'PENDING' && balance > 0)) && (
                  <button
                    onClick={() => {
                      setSelectedReq(req);
                      setPayAmount(balance);
                      setPayMethod(req.payment_preference);
                      setPendingReason('');
                      setCustomPendingReason('');
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-apple-blue hover:bg-apple-blue-hover transition-all"
                  >
                    💰 Bayar
                  </button>
                )}

                {/* Transfer Done */}
                {req.status === 'PENDING' && req.pending_reason?.includes('transfer') && (
                  <button
                    onClick={() => handleTransferDone(req.id)}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-all"
                  >
                    ✓ Transfer Sudah Dikirim
                  </button>
                )}

                {/* Mark Claimed */}
                {req.status === 'READY_FOR_CASH' && (
                  <button
                    onClick={() => handleComplete(req.id)}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all"
                  >
                    ✓ Sudah Diambil (Claimed)
                  </button>
                )}

                {/* Flag Issue */}
                {req.status === 'COMPLETED' && !req.post_claim_issue && (
                  <button
                    onClick={() => { setIssueReq(req); setIssueNote(''); }}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all"
                  >
                    ⚠️ Flag Issue
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Disbursement Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black text-apple-text-primary">💰 Proses Pembayaran</h3>
            <p className="text-sm text-apple-text-secondary">
              {selectedReq.creator?.name} — Total: <span className="font-bold text-apple-text-primary">{fmt(selectedReq.total_amount)}</span>
              {selectedReq.paid_amount > 0 && <>, Sudah dibayar: <span className="font-bold text-green-600">{fmt(selectedReq.paid_amount)}</span></>}
            </p>

            {/* Amount */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2">Jumlah Bayar</label>
              <input
                type="number"
                min={0}
                max={selectedReq.total_amount - (selectedReq.paid_amount || 0)}
                value={payAmount}
                onChange={e => setPayAmount(Number(e.target.value))}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-apple-blue/10 outline-none"
              />
            </div>

            {/* Method */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2">Metode Bayar</label>
              <div className="flex gap-2">
                {(['CASH', 'TRANSFER', 'OTHERS'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${payMethod === m ? 'bg-apple-blue text-white border-apple-blue' : 'bg-apple-gray-bg text-apple-text-secondary border-apple-gray-border'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Pending Reason (if partial) */}
            {payAmount < (selectedReq.total_amount - (selectedReq.paid_amount || 0)) && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2">Alasan Pending</label>
                <select
                  value={pendingReason}
                  onChange={e => setPendingReason(e.target.value)}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 outline-none appearance-none"
                >
                  <option value="">Pilih alasan...</option>
                  {PENDING_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {pendingReason === 'other' && (
                  <input
                    type="text"
                    value={customPendingReason}
                    onChange={e => setCustomPendingReason(e.target.value)}
                    placeholder="Alasan lainnya..."
                    className="mt-2 w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-2 outline-none"
                  />
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setSelectedReq(null)} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-apple-text-secondary bg-apple-gray-bg border border-apple-gray-border hover:bg-gray-100 transition-all">Batal</button>
              <button
                onClick={handleDisburse}
                disabled={processing || payAmount <= 0}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-apple-blue hover:bg-apple-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {processing ? 'Processing...' : `Bayar ${fmt(payAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Flag Modal */}
      {issueReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black text-apple-text-primary">⚠️ Flag Post-Claim Issue</h3>
            <p className="text-sm text-apple-text-secondary">Log masalah setelah pencairan (bon palsu, bon hilang, dll.)</p>
            <textarea
              value={issueNote}
              onChange={e => setIssueNote(e.target.value)}
              rows={3}
              placeholder="Contoh: Bon tidak lengkap, hanya ada 2 dari 3 item..."
              className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 outline-none resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setIssueReq(null)} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-apple-text-secondary bg-apple-gray-bg border border-apple-gray-border hover:bg-gray-100 transition-all">Batal</button>
              <button
                onClick={handleFlagIssue}
                disabled={!issueNote.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                Flag Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
