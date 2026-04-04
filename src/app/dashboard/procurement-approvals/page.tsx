'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { purchaseRequestsDb } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/format-utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { PurchaseRequest } from '@/types/types';

export default function ProcurementApprovalsPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
    if (!authLoading && profile && !canAccessRoute(profile, '/dashboard/procurement-approvals')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [authLoading, profile, router]);

  const loadRequests = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    try {
      // Only fetch submitted (pending approval) requests for all branches (or branch logic if needed)
      // For supervisors, usually they can see all.
      // purchaseRequestsDb.getAll takes branchId and status. 
      // If we pass undefined, it gets for all branches.
      const data = await purchaseRequestsDb.getAll(undefined, 'submitted');
      setRequests(data);
    } catch (err) {
      console.error('Failed to load PRs', err);
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) loadRequests();
  }, [profile, loadRequests]);

  const handleApprove = async (prId: string) => {
    if (!confirm('Are you sure you want to approve this purchase request?')) return;
    setProcessingId(prId);
    try {
      await purchaseRequestsDb.update(prId, {
        status: 'approved',
        approved_by: profile?.id,
        approved_at: new Date().toISOString()
      });
      setRequests(prev => prev.filter(r => r.id !== prId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving PR');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (prId: string) => {
    const reason = prompt('Please provide a reason for rejecting this request:');
    if (reason === null) return; // cancelled
    if (!reason.trim()) return alert('Rejection reason is mandatory.');

    setProcessingId(prId);
    try {
      await purchaseRequestsDb.update(prId, {
        status: 'rejected' as any, // if cancelled is used in DB, 'cancelled' or 'rejected'. Let's check type.
        rejection_reason: reason
      });
      setRequests(prev => prev.filter(r => r.id !== prId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting PR');
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading || fetching) return <div className="p-4 mx-auto max-w-6xl"><DashboardSkeleton /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 p-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Procurement Approvals</h1>
        <p className="text-gray-500 font-medium mt-1">Review and approve purchase requests from the warehouse.</p>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <EmptyState title="All Caught Up" description="There are no pending purchase requests awaiting your approval." />
        ) : (
          requests.map(pr => (
            <div key={pr.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{pr.title}</h3>
                  <p className="text-xs font-semibold text-gray-500 mt-1">
                    Requested by <span className="text-blue-600">{pr.requester?.name || 'Unknown'}</span> on {formatDate(pr.created_at)}
                  </p>
                  {pr.notes && (
                    <div className="mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-sm text-gray-700 italic">
                      "{pr.notes}"
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Est. Total</p>
                  <p className="text-xl font-black text-gray-900">{formatCurrency(pr.total_estimated)}</p>
                  <div className="mt-2">
                    <StatusBadge status={pr.status} />
                  </div>
                </div>
              </div>

              {/* Items */}
              {pr.items && pr.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Items Requested ({pr.items.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {pr.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{item.item_name}</p>
                          {item.estimated_price > 0 && (
                            <p className="text-[10px] font-semibold text-gray-500 mt-0.5">@ {formatCurrency(item.estimated_price)}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-gray-900">{item.quantity}</span>
                          <span className="text-[10px] font-bold text-gray-500 ml-1">{item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => handleReject(pr.id)}
                  disabled={processingId === pr.id}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {processingId === pr.id ? 'Processing...' : 'Reject Request'}
                </button>
                <button
                  onClick={() => handleApprove(pr.id)}
                  disabled={processingId === pr.id}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
                >
                  {processingId === pr.id ? 'Processing...' : 'Approve Request'}
                </button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
