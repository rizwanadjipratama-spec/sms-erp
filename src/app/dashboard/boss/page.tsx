'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { requestsDb, profilesDb } from '@/lib/db';
import { workflowEngine } from '@/lib/services/workflow-engine';
import { formatCurrency, formatDateTime, formatOrderId } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard, StatusBadge } from '@/components/ui';
import type { DbRequest, Profile } from '@/types/types';

export default function BossDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, Profile>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/boss')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching via DB layer ----------
  const refresh = useCallback(async () => {
    if (!profile) return;

    setFetching(true);
    setError(null);

    try {
      const { data } = await requestsDb.getByStatus(['priced']);
      setRequests(data);

      // Resolve client profiles for debt info
      const emails = data
        .map((r) => r.user_email)
        .filter((e): e is string => Boolean(e));
      const uniqueEmails = [...new Set(emails)];

      if (uniqueEmails.length > 0) {
        const profiles: Record<string, Profile> = {};
        await Promise.all(
          uniqueEmails.map(async (email) => {
            const p = await profilesDb.getByEmail(email);
            if (p) profiles[email] = p;
          })
        );
        setClientProfiles(profiles);
      }
    } catch (err) {
      console.error('Boss fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  // ---------- Realtime ----------
  useRealtimeTable('requests', 'status=eq.priced', refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  // ---------- Computed ----------
  const pendingCount = useMemo(() => requests.length, [requests]);
  const totalValue = useMemo(
    () => requests.reduce((sum, r) => sum + (r.total_price || 0), 0),
    [requests]
  );

  // ---------- Actor helper ----------
  const getActor = useCallback(() => {
    if (!profile) throw new Error('Authentication profile not loaded');
    return { id: profile.id, email: profile.email, role: profile.role };
  }, [profile]);

  // ---------- Approve ----------
  const approve = useCallback(
    async (request: DbRequest) => {
      const actor = getActor();
      setProcessingId(request.id);
      try {
        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: 'approved',
          action: 'approve',
          message: `Request ${formatOrderId(request.id)} approved by boss`,
          type: 'success',
          notifyRoles: ['finance', 'admin', 'owner'],
          metadata: {
            previous_status: request.status,
            total_price: request.total_price || 0,
          },
        });
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Approval failed');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor]
  );

  // ---------- Reject ----------
  const reject = useCallback(
    async (request: DbRequest) => {
      const reason = rejectionReason[request.id]?.trim();
      if (!reason) {
        alert('Rejection reason is required');
        return;
      }

      const actor = getActor();
      setProcessingId(request.id);
      try {
        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: 'rejected',
          action: 'reject',
          message: `Request ${formatOrderId(request.id)} rejected by boss. Reason: ${reason}`,
          type: 'error',
          notifyRoles: ['admin', 'owner', 'marketing'],
          extraUpdates: {
            note: reason,
            rejection_reason: reason,
          },
          metadata: {
            previous_status: request.status,
            rejection_reason: reason,
          },
        });
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        setRejectionReason((prev) => {
          const copy = { ...prev };
          delete copy[request.id];
          return copy;
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Rejection failed');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, rejectionReason]
  );

  // ---------- Loading / Error states ----------
  if (loading || fetching) {
    return (
      <div className="max-w-6xl mx-auto">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  // ---------- Render ----------
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">
          Boss Approval Queue
        </h1>
        <p className="text-apple-text-secondary text-sm mt-1">
          {pendingCount} pending request{pendingCount === 1 ? '' : 's'} awaiting a decision.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Pending Approvals" value={pendingCount} color="yellow" />
        <StatCard
          label="Total Value"
          value={formatCurrency(totalValue)}
          color="blue"
        />
        <StatCard
          label="Avg. Order Value"
          value={pendingCount > 0 ? formatCurrency(Math.round(totalValue / pendingCount)) : '-'}
          color="purple"
        />
      </div>

      {/* Empty state */}
      {requests.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="Marketing and client requests will appear here once they are priced."
        />
      ) : (
        <div className="space-y-5">
          {requests.map((request) => {
            const clientProfile = request.user_email
              ? clientProfiles[request.user_email]
              : undefined;
            const debtExceeded =
              clientProfile &&
              (clientProfile.debt_amount || 0) > (clientProfile.debt_limit || 0);
            const isProcessing = processingId === request.id;

            return (
              <div
                key={request.id}
                className="bg-white border border-apple-gray-border rounded-apple p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                {/* Card header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                  <div>
                    <p className="font-semibold text-apple-text-primary">
                      {request.user_email || request.user_id}
                    </p>
                    <p className="text-xs text-apple-text-secondary mt-1 font-medium">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="priced" />
                    <span className="text-[10px] font-bold px-2 py-1 bg-apple-gray-bg text-apple-text-secondary rounded-full uppercase tracking-wider">
                      {request.priority?.toUpperCase()}
                    </span>
                    {clientProfile && (
                      <span className="text-[10px] font-bold px-2 py-1 bg-apple-gray-bg text-apple-text-secondary rounded-full uppercase tracking-wider">
                        {clientProfile.client_type || 'regular'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="grid md:grid-cols-[1.4fr_1fr] gap-5">
                  {/* Left: items + note */}
                  <div className="space-y-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Items</p>
                      <div className="space-y-2 text-sm text-gray-700">
                        {(request.request_items || []).map((item: any, idx: number) => (
                          <div key={`${request.id}-${idx}`} className="flex justify-between gap-3">
                            <span>{item.products?.name || item.product_id}</span>
                            <span className="text-gray-500">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {request.note && (
                      <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                        <p className="text-xs uppercase tracking-wider text-purple-600/80 mb-1">
                          Commercial Note
                        </p>
                        <p className="text-sm text-purple-900">{request.note}</p>
                      </div>
                    )}
                  </div>

                  {/* Right: summary + debt + actions */}
                  <div className="space-y-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Commercial Summary
                      </p>
                      <p className="text-xl font-semibold text-gray-900">
                        {request.total_price && request.total_price > 0
                          ? formatCurrency(request.total_price)
                          : 'Price not set'}
                      </p>
                    </div>

                    {clientProfile && (
                      <div
                        className={`rounded-xl border p-4 ${
                          debtExceeded
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                          Client Debt
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatCurrency(clientProfile.debt_amount)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Limit: {formatCurrency(clientProfile.debt_limit)}
                        </p>
                        {debtExceeded && (
                          <p className="text-xs text-amber-600 font-bold mt-2">
                            Debt exceeds allowed limit.
                          </p>
                        )}
                      </div>
                    )}

                    <textarea
                      placeholder="Rejection reason..."
                      value={rejectionReason[request.id] || ''}
                      onChange={(e) =>
                        setRejectionReason((prev) => ({
                          ...prev,
                          [request.id]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-lg px-3 py-2 text-sm text-apple-text-primary placeholder-apple-text-secondary/50 focus:ring-2 focus:ring-apple-warning/20 focus:border-apple-warning outline-none transition-all resize-none"
                    />

                    <div className="flex gap-3">
                      <button
                        onClick={() => approve(request)}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 bg-apple-success hover:bg-apple-success/90 text-white text-sm font-semibold rounded-apple transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      >
                        {isProcessing ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => reject(request)}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 bg-apple-danger hover:bg-apple-danger/90 text-white text-sm font-semibold rounded-apple transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
