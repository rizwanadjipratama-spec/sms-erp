'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { requestsDb, profilesDb } from '@/lib/db';
import { workflowEngine, authService, autoApproveService } from '@/lib/services';
import type { AutoApproveSettings, AutoApproveResult } from '@/lib/services';
import { formatCurrency, formatDateTime, formatOrderId } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard, StatusBadge, OrderNotes } from '@/components/ui';
import type { DbRequest, DiscountType, Profile } from '@/types/types';

export default function BossDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, Profile>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [discountOverrides, setDiscountOverrides] = useState<Record<string, { type: DiscountType; value: number; reason: string }>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-approve state
  const [autoSettings, setAutoSettings] = useState<AutoApproveSettings | null>(null);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoApproveResult | null>(null);
  const [skippedReasons, setSkippedReasons] = useState<Record<string, string>>({});

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/boss')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching via DB layer ----------
  const refresh = useCallback(async () => {
    if (!profile) return;

    setFetching(true);
    setError(null);

    try {
      const { data } = await requestsDb.getByStatus(['priced'], undefined, activeBranchId);
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
  }, [profile, activeBranchId]);

  // Fetch auto-approve settings
  useEffect(() => {
    if (!activeBranchId) return;
    autoApproveService.getSettings(activeBranchId).then(setAutoSettings);
  }, [activeBranchId]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh, activeBranchId]);

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

  // ---------- Discount calculator ----------
  const calcBossDiscount = useCallback(
    (request: DbRequest): number => {
      const override = discountOverrides[request.id];
      if (!override || override.value <= 0) return 0;
      const base = request.total_price || 0;
      if (override.type === 'percent') {
        return Math.round(base * Math.min(override.value, 100) / 100);
      }
      return Math.min(override.value, base);
    },
    [discountOverrides]
  );

  // ---------- Approve ----------
  const approve = useCallback(
    async (request: DbRequest) => {
      const actor = getActor();
      setProcessingId(request.id);
      try {
        // Boss can override/add discount
        const override = discountOverrides[request.id];
        const bossDiscountAmt = calcBossDiscount(request);
        const hasOverride = bossDiscountAmt > 0 && override;

        const extraUpdates: Partial<DbRequest> = {};
        if (hasOverride) {
          extraUpdates.discount_type = override.type;
          extraUpdates.discount_value = override.value;
          extraUpdates.discount_amount = bossDiscountAmt;
          extraUpdates.discount_reason = override.reason || request.discount_reason || undefined;
          extraUpdates.discounted_by = actor.id;
        }

        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: 'approved',
          action: 'approve',
          message: `Request ${formatOrderId(request.id)} approved by boss${bossDiscountAmt > 0 ? ` (discount ${formatCurrency(bossDiscountAmt)})` : ''}`,
          type: 'success',
          notifyRoles: ['finance', 'admin', 'owner'],
          extraUpdates,
          metadata: {
            previous_status: request.status,
            total_price: request.total_price || 0,
            ...(bossDiscountAmt > 0 ? { boss_discount: bossDiscountAmt } : {}),
          },
        });
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Approval failed');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, discountOverrides, calcBossDiscount]
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

  // ---------- Auto Process ----------
  const runAutoProcess = useCallback(
    async () => {
      if (!autoSettings || !profile) return;
      const actor = getActor();
      setAutoProcessing(true);
      setAutoResult(null);
      try {
        const result = await autoApproveService.processAutoApproval(
          requests,
          clientProfiles,
          autoSettings,
          actor,
        );
        setAutoResult(result);

        // Build skipped-reason lookup
        const reasons: Record<string, string> = {};
        result.skipped.forEach(s => { reasons[s.request.id] = s.reason; });
        setSkippedReasons(reasons);

        // Remove processed items from the list
        const processedIds = new Set([
          ...result.approved.map(r => r.id),
          ...result.rejected.map(r => r.id),
        ]);
        setRequests(prev => prev.filter(r => !processedIds.has(r.id)));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Auto-process failed');
      } finally {
        setAutoProcessing(false);
      }
    },
    [autoSettings, profile, requests, clientProfiles, getActor]
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
      {/* Auto-result banner */}
      {autoResult && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <p className="text-sm font-bold text-blue-800">⚡ Auto-proses selesai</p>
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            {autoResult.approved.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">✅ {autoResult.approved.length} Approved</span>
            )}
            {autoResult.rejected.length > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full">❌ {autoResult.rejected.length} Rejected</span>
            )}
            {autoResult.skipped.length > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">⏭️ {autoResult.skipped.length} Skipped (manual)</span>
            )}
          </div>
          <button onClick={() => setAutoResult(null)} className="text-[10px] text-blue-500 hover:underline">Tutup</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">
            Boss Approval Queue
          </h1>
          <p className="text-apple-text-secondary text-sm mt-1">
            {pendingCount} pending request{pendingCount === 1 ? '' : 's'} awaiting a decision.
          </p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={runAutoProcess}
            disabled={autoProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 disabled:opacity-60"
          >
            {autoProcessing ? (
              <><span className="animate-spin">⏳</span> Processing...</>
            ) : (
              <><span>⚡</span> Auto Mode</>
            )}
          </button>
        )}
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
            const skipReason = skippedReasons[request.id];

            return (
              <div
                key={request.id}
                className={`bg-white border rounded-apple p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${skipReason ? 'border-amber-300 ring-1 ring-amber-200' : 'border-apple-gray-border'}`}
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
                    {skipReason && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 uppercase tracking-wider"
                        title={skipReason}
                      >
                        🆕 Manual Review
                      </span>
                    )}
                    {request.branch && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {request.branch.name}
                      </span>
                    )}
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
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Items & Pricing</p>
                      <div className="space-y-3 text-sm text-gray-700">
                        {(request.request_items || []).map((item: any, idx: number) => {
                          const itemName = item.products?.name || item.product_id;
                          const basePrice = item.price_at_order || 0;
                          const discPct = item.discount_percentage || 0;
                          const finalUnitPrice = basePrice * (1 - discPct / 100);
                          const totalLinePrice = finalUnitPrice * item.quantity;
                          
                          return (
                            <div key={`${request.id}-${idx}`} className="flex flex-col gap-1 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                              <div className="flex justify-between gap-3">
                                <span className="font-semibold text-gray-900 truncate">{itemName}</span>
                                <span className="text-gray-500 font-bold shrink-0 text-right w-12">x{item.quantity}</span>
                              </div>
                              <div className="flex justify-between text-[11px] text-gray-500">
                                <span>
                                  {formatCurrency(basePrice)} 
                                  {discPct > 0 && <span className="text-amber-600 ml-1 font-semibold">(-{discPct}%)</span>}
                                </span>
                                <span className="font-medium text-gray-700">{formatCurrency(totalLinePrice)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <OrderNotes
                      requestId={request.id}
                      allowedTargetRoles={['marketing', 'client', 'finance']}
                      compact
                    />
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
                      {(request.discount_amount ?? 0) > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-green-600 font-medium">
                            Marketing Discount: -{formatCurrency(request.discount_amount ?? 0)}
                            {request.discount_type === 'percent' && ` (${request.discount_value}%)`}
                          </p>
                          {request.discount_reason && (
                            <p className="text-xs text-gray-500 mt-0.5">Reason: {request.discount_reason}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Boss discount override */}
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Boss Discount (Optional)
                      </p>
                      <div className="flex gap-2">
                        <select
                          value={discountOverrides[request.id]?.type || 'percent'}
                          onChange={(e) =>
                            setDiscountOverrides((prev) => ({
                              ...prev,
                              [request.id]: {
                                ...(prev[request.id] || { value: 0, reason: '' }),
                                type: e.target.value as DiscountType,
                              },
                            }))
                          }
                          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                        >
                          <option value="percent">Percent %</option>
                          <option value="fixed">Fixed (Rp)</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={discountOverrides[request.id]?.type === 'percent' ? 100 : undefined}
                          value={discountOverrides[request.id]?.value || ''}
                          onChange={(e) =>
                            setDiscountOverrides((prev) => ({
                              ...prev,
                              [request.id]: {
                                ...(prev[request.id] || { type: 'percent' as DiscountType, reason: '' }),
                                value: Number(e.target.value) || 0,
                              },
                            }))
                          }
                          placeholder="0"
                          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                        />
                      </div>
                      {(discountOverrides[request.id]?.value ?? 0) > 0 && (
                        <>
                          <input
                            type="text"
                            value={discountOverrides[request.id]?.reason || ''}
                            onChange={(e) =>
                              setDiscountOverrides((prev) => ({
                                ...prev,
                                [request.id]: {
                                  ...prev[request.id],
                                  reason: e.target.value,
                                },
                              }))
                            }
                            placeholder="Reason for discount..."
                            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                          />
                          <p className="mt-1 text-xs text-green-600 font-medium">
                            Discount: -{formatCurrency(calcBossDiscount(request))}
                            {' → '}Final: {formatCurrency((request.total_price || 0) - calcBossDiscount(request))}
                          </p>
                        </>
                      )}
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
