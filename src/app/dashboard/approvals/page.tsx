'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { approvalsDb } from '@/lib/db';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { Approval, ApprovalStatus } from '@/types/types';

type TabKey = 'pending' | 'all';

export default function ApprovalsDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [pending, setPending] = useState<Approval[]>([]);
  const [all, setAll] = useState<Approval[]>([]);
  const [tab, setTab] = useState<TabKey>('pending');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/approvals')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const [pendingData, allData] = await Promise.all([
        approvalsDb.getPending(),
        approvalsDb.getAll(),
      ]);
      setPending(pendingData);
      setAll(allData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => { if (profile) refreshAll(); }, [profile, refreshAll]);

  const stats = useMemo(() => ({
    pendingCount: pending.length,
    approvedCount: all.filter(a => a.status === 'approved').length,
    rejectedCount: all.filter(a => a.status === 'rejected').length,
    totalValue: pending.reduce((s, a) => s + Number(a.amount ?? 0), 0),
  }), [pending, all]);

  const handleApprove = useCallback(async (id: string) => {
    if (!profile) return;
    setProcessingId(id);
    try {
      await approvalsDb.approve(id, profile.id);
      await refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  }, [profile, refreshAll]);

  const handleReject = useCallback(async (id: string) => {
    if (!profile) return;
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setProcessingId(id);
    try {
      await approvalsDb.reject(id, profile.id, reason);
      await refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  }, [profile, refreshAll]);

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      expense_claim: '💰 Expense Claim',
      purchase_request: '📦 Purchase Request',
      cash_advance: '💵 Cash Advance',
      discount: '🏷️ Discount',
      stock_transfer: '🔄 Stock Transfer',
      branch_override: '🏢 Branch Override',
      maintenance_cost: '🔧 Maintenance',
      large_purchase: '🛒 Large Purchase',
    };
    return labels[type] || type;
  };

  if (loading || fetching) {
    return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><DashboardSkeleton /></div>;
  }
  if (error) {
    return <div className="mx-auto max-w-6xl p-4 sm:p-6"><ErrorState message={error} onRetry={refreshAll} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Approval Center</h1>
        <p className="mt-1 text-sm text-gray-500">Review and process pending approvals across all modules.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending" value={stats.pendingCount} color="yellow" />
        <StatCard label="Approved" value={stats.approvedCount} color="green" />
        <StatCard label="Rejected" value={stats.rejectedCount} color="red" />
        <StatCard label="Pending Value" value={formatCurrency(stats.totalValue)} color="blue" />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([
          { key: 'pending' as TabKey, label: `Pending (${pending.length})` },
          { key: 'all' as TabKey, label: `All (${all.length})` },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
              tab === item.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <section className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState title="All clear!" description="No approvals waiting for review." />
          ) : (
            pending.map(a => (
              <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{typeLabel(a.approval_type)}</span>
                    </div>
                    <p className="font-medium text-gray-900 mt-1">{a.title}</p>
                    {a.description && <p className="mt-0.5 text-sm text-gray-500">{a.description}</p>}
                    <p className="mt-1 text-xs text-gray-400">
                      {a.requester ? `${(a.requester as any).name} · ` : ''}{formatRelative(a.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {a.amount && <p className="text-lg font-bold text-gray-900">{formatCurrency(a.amount)}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(a.id)}
                        disabled={processingId === a.id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(a.id)}
                        disabled={processingId === a.id}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {processingId === a.id ? 'Processing...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'all' && (
        <section className="space-y-3">
          {all.length === 0 ? (
            <EmptyState title="No approvals" description="No approval history found." />
          ) : (
            all.map(a => (
              <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{typeLabel(a.approval_type)}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="truncate font-medium text-gray-900 mt-1">{a.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(a.created_at)}</p>
                </div>
                <div className="text-right">
                  {a.amount && <p className="font-semibold text-gray-900">{formatCurrency(a.amount)}</p>}
                  {a.rejection_reason && <p className="text-xs text-red-500 mt-0.5">Reason: {a.rejection_reason}</p>}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
