'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { deliveryService, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { formatDateTime, formatRelative, formatOrderId } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { OrderNotes } from '@/components/ui';
import type { DbRequest, DeliveryLog, DeliverySubStatus, Actor } from '@/types/types';

const SUB_STATUSES: { key: DeliverySubStatus; label: string }[] = [
  { key: 'otw', label: 'OTW' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'delivering', label: 'Delivering' },
  { key: 'completed', label: 'Completed' },
];

function DeliveryProgressStepper({ currentStatus }: { currentStatus: string }) {
  const currentIdx = SUB_STATUSES.findIndex(s => s.key === currentStatus);

  return (
    <div className="flex items-center gap-1 w-full">
      {SUB_STATUSES.map((step, idx) => {
        const isActive = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`w-full h-2 rounded-full transition-all duration-300 ${
                isActive
                  ? isCurrent
                    ? 'bg-[var(--apple-blue)] animate-pulse'
                    : 'bg-[var(--apple-blue)]'
                  : 'bg-gray-200'
              }`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isActive ? 'text-[var(--apple-blue)]' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CourierDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<DbRequest[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [staffInput, setStaffInput] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/courier')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Build actor
  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return { id: user.id, email: user.email ?? profile?.email, role };
  }, [profile, role]);

  // Fetch data
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const data = await deliveryService.getCourierDashboard(profile.id);
      setOrders(data.orders);
      setDeliveryLogs(data.deliveryLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // Realtime
  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });
  useRealtimeTable(
    'delivery_logs',
    profile?.id ? `courier_id=eq.${profile.id}` : undefined,
    refresh,
    { enabled: Boolean(profile?.id), debounceMs: 250 },
  );

  // ── Handlers ──────────────────────────────────────────────────────────
  const claimDelivery = useCallback(
    async (request: DbRequest) => {
      setProcessingId(request.id);
      try {
        const actor = await getActor();
        await deliveryService.startDelivery(request, actor, staffInput[request.id]);
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to claim delivery');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, refresh, staffInput],
  );

  const advanceSubStatus = useCallback(
    async (logId: string, nextStatus: DeliverySubStatus) => {
      setProcessingId(logId);
      try {
        const actor = await getActor();
        await deliveryService.updateDeliverySubStatus(logId, nextStatus, actor);
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update status');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, refresh],
  );

  const uploadProof = useCallback(
    async (requestId: string, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setUploadingId(requestId);
      try {
        const actor = await getActor();
        const proofUrl = await deliveryService.uploadProof(file, requestId, actor);
        setProofUrls(prev => ({ ...prev, [requestId]: proofUrl }));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Proof upload failed');
      } finally {
        setUploadingId(null);
        event.target.value = '';
      }
    },
    [getActor],
  );

  const completeDelivery = useCallback(
    async (request: DbRequest) => {
      setProcessingId(request.id);
      try {
        const actor = await getActor();
        await deliveryService.completeDelivery({
          request,
          actor,
          proofUrl: proofUrls[request.id],
          note: notes[request.id],
        });
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to complete delivery');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, refresh, proofUrls, notes],
  );

  // ── Computed ──────────────────────────────────────────────────────────
  const readyOrders = useMemo(() => orders.filter(o => o.status === 'ready'), [orders]);
  const inDelivery = useMemo(() => orders.filter(o => o.status === 'on_delivery'), [orders]);
  const deliveredOrders = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);

  const completedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deliveryLogs.filter(
      log => log.delivered_at && new Date(log.delivered_at) >= today,
    ).length;
  }, [deliveryLogs]);

  // Find the active delivery log for an order
  const getActiveLog = useCallback(
    (orderId: string): DeliveryLog | undefined =>
      deliveryLogs.find(l => l.order_id === orderId && l.status !== 'completed' && l.status !== 'delivered'),
    [deliveryLogs],
  );

  const getNextSubStatus = (currentStatus: string): DeliverySubStatus | null => {
    const idx = SUB_STATUSES.findIndex(s => s.key === currentStatus);
    if (idx < 0 || idx >= SUB_STATUSES.length - 1) return null;
    return SUB_STATUSES[idx + 1].key;
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading || (fetching && orders.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-6 sm:text-left">
        <h1 className="text-2xl font-bold text-[var(--apple-text-primary)] tracking-tight">
          Courier Dashboard
        </h1>
        <p className="text-[var(--apple-text-secondary)] text-sm max-w-md">
          Claim delivery jobs, track progress, upload proofs, and complete deliveries.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Ready Jobs"
          value={readyOrders.length}
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          label="Active Deliveries"
          value={inDelivery.length}
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          }
        />
        <StatCard
          label="Completed Today"
          value={completedToday}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Ready Jobs ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--apple-text-primary)] tracking-tight">
            Ready Jobs
          </h2>
          <span className="text-xs font-bold text-[var(--apple-text-secondary)] uppercase tracking-widest">
            {readyOrders.length} available
          </span>
        </div>

        {readyOrders.length === 0 ? (
          <EmptyState icon="📦" title="No Ready Jobs" description="All orders are being processed. Check back soon." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {readyOrders.map(request => (
              <div key={request.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div>
                    <p className="font-bold text-[var(--apple-text-primary)] text-sm">
                      {request.user_email || request.user_id}
                    </p>
                    <p className="text-xs text-[var(--apple-text-secondary)] mt-0.5">
                      {formatRelative(request.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                  {request.branch && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      {request.branch.name}
                    </span>
                  )}
                </div>

                {/* Items preview */}
                <div className="space-y-1.5 mb-4 bg-[var(--apple-gray-bg)] p-3 rounded-lg border border-[var(--apple-border)]">
                  {(request.request_items || []).slice(0, 3).map((item, idx) => (
                    <div key={`${request.id}-${idx}`} className="flex justify-between items-center text-xs">
                      <span className="text-[var(--apple-text-secondary)] font-medium truncate pr-2">
                        {item.products?.name || item.product_id}
                      </span>
                      <span className="text-[var(--apple-text-primary)] font-bold shrink-0">x{item.quantity}</span>
                    </div>
                  ))}
                  {(request.request_items?.length ?? 0) > 3 && (
                    <p className="text-xs text-[var(--apple-text-tertiary)]">+{(request.request_items?.length ?? 0) - 3} more</p>
                  )}
                </div>

                <div className="mb-4">
                  <OrderNotes
                    requestId={request.id}
                    allowedTargetRoles={['warehouse', 'client']}
                    compact
                  />
                </div>

                {/* Accompanying staff input */}
                <input
                  type="text"
                  placeholder="Accompanying staff (optional)"
                  value={staffInput[request.id] || ''}
                  onChange={e => setStaffInput(prev => ({ ...prev, [request.id]: e.target.value }))}
                  className="w-full mb-3 px-3 py-2 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all"
                />

                <button
                  onClick={() => claimDelivery(request)}
                  disabled={processingId === request.id}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === request.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Claim & Start Delivery'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Active Deliveries ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--apple-text-primary)] tracking-tight">
            My Active Deliveries
          </h2>
          <span className="text-xs font-bold text-[var(--apple-text-secondary)] uppercase tracking-widest">
            {inDelivery.length} in progress
          </span>
        </div>

        {inDelivery.length === 0 ? (
          <EmptyState icon="🚚" title="No Active Deliveries" description="Claim a ready job above to start." />
        ) : (
          <div className="space-y-4">
            {inDelivery.map(request => {
              const activeLog = getActiveLog(request.id);
              const currentSubStatus = (activeLog?.status as DeliverySubStatus) || 'otw';
              const nextSubStatus = getNextSubStatus(currentSubStatus);
              const isLastStep = currentSubStatus === 'delivering';

              return (
                <div key={request.id} className="bg-white border-2 border-[var(--apple-border)] hover:border-[var(--apple-blue)]/30 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                    <div>
                      <p className="font-bold text-[var(--apple-text-primary)] text-lg">
                        {request.user_email || request.user_id}
                      </p>
                      <p className="text-sm text-[var(--apple-text-secondary)]">
                        {formatDateTime(request.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={request.status} size="md" />
                      {request.priority === 'cito' && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-full uppercase">
                          CITO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4-Stage Progress Stepper */}
                  <div className="mb-6 p-4 bg-[var(--apple-gray-bg)] rounded-xl border border-[var(--apple-border)]">
                    <DeliveryProgressStepper currentStatus={currentSubStatus} />
                  </div>

                  {/* Accompanying staff info */}
                  {activeLog?.accompanying_staff && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-[var(--apple-text-secondary)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Staff: <span className="font-semibold text-[var(--apple-text-primary)]">{activeLog.accompanying_staff}</span></span>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-2 mb-6 pb-6 border-b border-[var(--apple-border)]">
                    {(request.request_items || []).slice(0, 4).map((item, idx) => (
                      <div key={`${request.id}-${idx}`} className="flex justify-between items-center py-1 px-1">
                        <span className="text-[var(--apple-text-secondary)] font-medium text-sm truncate flex-1 pr-2">
                          {item.products?.name || item.product_id}
                        </span>
                        <span className="text-[var(--apple-text-primary)] font-bold text-base min-w-[40px] text-right">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                    {(request.request_items?.length ?? 0) > 4 && (
                      <p className="text-xs text-[var(--apple-text-tertiary)] px-1">+{(request.request_items?.length ?? 0) - 4} more</p>
                    )}
                  </div>

                  {/* Advance sub-status button (if not on last step) */}
                  {nextSubStatus && !isLastStep && activeLog && (
                    <button
                      onClick={() => advanceSubStatus(activeLog.id, nextSubStatus)}
                      disabled={processingId === activeLog.id}
                      className="w-full mb-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processingId === activeLog.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Update to: {SUB_STATUSES.find(s => s.key === nextSubStatus)?.label}
                        </>
                      )}
                    </button>
                  )}

                  {/* Proof upload + notes (visible when delivering or later) */}
                  {isLastStep && (
                    <div className="space-y-4 mb-4">
                      {/* Proof Upload */}
                      <div>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)] mb-2">
                          Delivery Proof Photo
                        </label>
                        <label className="w-full h-20 sm:h-16 flex items-center justify-center bg-[var(--apple-gray-bg)] hover:bg-gray-100 border-2 border-dashed border-[var(--apple-border)] hover:border-[var(--apple-blue)] rounded-xl cursor-pointer transition-all duration-200">
                          {proofUrls[request.id] ? (
                            <div className="flex items-center gap-2 text-[var(--apple-success)]">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm font-medium">Proof uploaded</span>
                            </div>
                          ) : uploadingId === request.id ? (
                            <div className="flex items-center gap-2 text-[var(--apple-blue)]">
                              <div className="w-5 h-5 border-2 border-[var(--apple-blue)] border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm font-medium">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-[var(--apple-text-secondary)]">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-sm font-medium">Tap to upload photo</span>
                            </div>
                          )}
                          <input type="file" accept="image/*" onChange={e => uploadProof(request.id, e)} className="sr-only" />
                        </label>
                        {proofUrls[request.id] && (
                          <a href={proofUrls[request.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-sm text-[var(--apple-blue)] hover:underline font-medium">
                            View proof photo
                          </a>
                        )}
                      </div>

                      {/* Delivery Note */}
                      <div>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)] mb-2">
                          Delivery Note (optional)
                        </label>
                        <textarea
                          placeholder="e.g. Delivered to front desk, customer signed receipt..."
                          value={notes[request.id] || ''}
                          onChange={e => setNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
                          rows={3}
                          className="w-full bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] hover:border-gray-300 focus:border-[var(--apple-blue)] rounded-xl px-4 py-3 text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--apple-blue)]/20 resize-vertical transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Complete Delivery button (only when on 'delivering' step) */}
                  {isLastStep && (
                    <button
                      onClick={() => completeDelivery(request)}
                      disabled={processingId === request.id}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-base font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingId === request.id ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Completing Delivery...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>DELIVERY COMPLETE</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Delivery History ───────────────────────────────────────────── */}
      <section className="bg-white border border-[var(--apple-border)] shadow-sm rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-[var(--apple-text-primary)] mb-4">Delivery History</h2>
        {deliveryLogs.length === 0 ? (
          <EmptyState icon="📋" title="No Delivery History" description="No completed deliveries yet." />
        ) : (
          <div className="space-y-3">
            {deliveryLogs.filter(l => l.status === 'completed' || l.status === 'delivered').map(log => (
              <div key={log.id} className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-gray-bg)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--apple-text-primary)]">
                    Order {formatOrderId(log.order_id)}
                  </p>
                  <p className="text-xs text-[var(--apple-text-secondary)] mt-1">
                    {log.delivered_at ? formatDateTime(log.delivered_at) : 'Delivered'}
                  </p>
                  {log.accompanying_staff && (
                    <p className="text-xs text-[var(--apple-text-secondary)] mt-1">Staff: {log.accompanying_staff}</p>
                  )}
                  {log.note && (
                    <p className="text-sm text-[var(--apple-text-secondary)] mt-2">{log.note}</p>
                  )}
                </div>
                <div className="text-right space-y-1">
                  {log.proof_url && (
                    <a href={log.proof_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--apple-blue)] hover:underline font-medium">
                      View proof
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Delivered Orders (awaiting client confirmation) ─────────── */}
      {deliveredOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--apple-text-primary)] mb-3">Delivered (Awaiting Confirmation)</h2>
          <div className="space-y-3">
            {deliveredOrders.map(request => (
              <div key={request.id} className="bg-white border border-[var(--apple-border)] shadow-sm rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--apple-text-primary)]">
                    {request.user_email || request.user_id}
                  </p>
                  <p className="text-xs text-[var(--apple-text-secondary)] mt-1">
                    Delivered {formatRelative(request.delivered_at)}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
