'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { requestsDb, profilesDb } from '@/lib/db';
import { workflowEngine, ACTIVE_STATUSES, authService, deliveryService } from '@/lib/services';
import { formatCurrency, formatDateTime, formatDate, formatOrderId } from '@/lib/format-utils';
import {
  DashboardSkeleton,
  EmptyState,
  ErrorState,
  OrderNotes,
  StatCard,
  StatusBadge,
  Modal,
} from '@/components/ui';
import type { DbRequest, DeliveryLog, DeliverySubStatus, RequestStatus } from '@/types/types';

// ---------- Timeline configuration ----------
const TIMELINE_STEPS: Array<{ key: RequestStatus; label: string }> = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'priced', label: 'Priced' },
  { key: 'approved', label: 'Approved' },
  { key: 'invoice_ready', label: 'Invoice' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'on_delivery', label: 'On Delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
];

function getStepIndex(status: RequestStatus) {
  return TIMELINE_STEPS.findIndex((step) => step.key === status);
}

const CANCEL_REASONS = ['Wrong item', 'Change plan', 'Ordered by mistake', 'Need revision', 'Other'];
const CANCELLABLE_STATUSES: RequestStatus[] = ['submitted', 'priced', 'approved'];

export default function ClientDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [handlerName, setHandlerName] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Cancel modal state
  const [deliveryTracking, setDeliveryTracking] = useState<Record<string, DeliveryLog | null>>({});
  const [cancellingRequest, setCancellingRequest] = useState<DbRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherReason, setCancelOtherReason] = useState('');

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/client')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching via DB layer ----------
  const refresh = useCallback(async () => {
    if (!profile?.id) return;

    setFetching(true);
    setError(null);

    try {
      const { data } = await requestsDb.getByUser(profile.id);
      setRequests(data);

      // Fetch handler (marketing person) name
      if (profile.handled_by) {
        const handler = await profilesDb.getById(profile.handled_by);
        setHandlerName(handler?.name || handler?.email || null);
      }

      // Fetch delivery tracking for on_delivery orders
      const onDeliveryOrders = data.filter(r => r.status === 'on_delivery');
      if (onDeliveryOrders.length > 0) {
        const trackingResults = await Promise.all(
          onDeliveryOrders.map(async r => {
            const log = await deliveryService.getDeliveryTracking(r.id);
            return [r.id, log] as const;
          })
        );
        setDeliveryTracking(Object.fromEntries(trackingResults));
      }
    } catch (err) {
      console.error('Client fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setFetching(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  // ---------- Realtime ----------
  useRealtimeTable(
    'requests',
    profile?.id ? `user_id=eq.${profile.id}` : undefined,
    refresh,
    { enabled: Boolean(profile?.id), debounceMs: 250 }
  );

  useRealtimeTable(
    'issues',
    profile?.id ? `reported_by=eq.${profile.id}` : undefined,
    refresh,
    { enabled: Boolean(profile?.id), debounceMs: 250 }
  );

  useRealtimeTable(
    'notifications',
    profile?.id ? `user_id=eq.${profile.id}` : undefined,
    refresh,
    { enabled: Boolean(profile?.id), debounceMs: 250 }
  );

  // ---------- Computed ----------
  const activeOrders = useMemo(
    () => requests.filter((r) => ACTIVE_STATUSES.includes(r.status)),
    [requests]
  );

  const doneOrders = useMemo(
    () => requests.filter((r) => ['completed', 'resolved', 'rejected', 'cancelled'].includes(r.status)),
    [requests]
  );

  const totalSpent = useMemo(
    () =>
      doneOrders
        .filter((r) => r.status === 'completed' || r.status === 'resolved')
        .reduce((sum, r) => sum + (r.total_price || 0), 0),
    [doneOrders]
  );

  // ---------- Actor helper ----------
  const getActor = useCallback(() => {
    if (!profile) throw new Error('User profile not loaded');
    return { id: profile.id, email: profile.email, role: profile.role };
  }, [profile]);

  // ---------- Confirm delivery ----------
  const confirmCompleted = useCallback(
    async (request: DbRequest) => {
      const actor = getActor();
      setProcessingId(request.id);
      try {
        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: 'completed',
          action: 'confirm_completed',
          message: `Order ${formatOrderId(request.id)} confirmed as received by client`,
          type: 'success',
          notifyRoles: ['owner'],
        });
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to confirm receipt');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, refresh]
  );

  // ---------- Cancel request ----------
  const handleCancelRequest = useCallback(async () => {
    if (!cancellingRequest) return;

    const finalReason = cancelReason === 'Other' ? cancelOtherReason : cancelReason;
    if (!finalReason) {
      alert('Please select or specify a reason');
      return;
    }

    const actor = getActor();
    setProcessingId(cancellingRequest.id);
    try {
      await workflowEngine.transition({
        request: cancellingRequest,
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        nextStatus: 'cancelled',
        action: 'cancel_request',
        message: `Request ${formatOrderId(cancellingRequest.id)} cancelled by client. Reason: ${finalReason}`,
        notifyRoles: ['admin', 'owner', 'marketing'],
        extraUpdates: {
          note: finalReason,
        },
      });
      setCancellingRequest(null);
      setCancelReason('');
      setCancelOtherReason('');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel request');
    } finally {
      setProcessingId(null);
    }
  }, [cancellingRequest, cancelReason, cancelOtherReason, getActor, refresh]);

  const closeCancelModal = useCallback(() => {
    setCancellingRequest(null);
    setCancelReason('');
    setCancelOtherReason('');
  }, []);

  // ---------- Loading / Error states ----------
  if (loading || fetching) {
    return (
      <div className="max-w-5xl mx-auto">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  // ---------- Render ----------
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">My Orders</h1>
          <p className="text-apple-text-secondary text-sm mt-1">
            Track your full request lifecycle in one place.
          </p>
        </div>
        <Link
          href="/request"
          className="bg-apple-blue hover:bg-apple-blue-hover text-white text-sm font-bold px-6 py-2 rounded-apple transition-all active:scale-95 shadow-sm text-center"
        >
          New Request
        </Link>
      </div>

      {/* Debt warning */}
      {profile && profile.debt_amount > profile.debt_limit && (
        <div className="bg-apple-danger/5 border border-apple-danger/20 rounded-apple p-4 flex items-center gap-3">
          <div className="text-apple-danger text-xl shrink-0">&#x26A0;&#xFE0F;</div>
          <div>
            <p className="text-apple-danger font-bold text-sm">Debt limit exceeded</p>
            <p className="text-apple-text-secondary text-xs mt-0.5">
              Current debt {formatCurrency(profile.debt_amount)} &bull; limit{' '}
              {formatCurrency(profile.debt_limit)}.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active Orders" value={activeOrders.length} color="blue" />
        <StatCard label="Completed" value={doneOrders.length} color="green" />
        <StatCard label="Total Spent" value={formatCurrency(totalSpent)} color="purple" />
      </div>

      {/* Handled by */}
      {handlerName && (
        <div className="flex items-center gap-3 bg-apple-blue/5 border border-apple-blue/10 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-bold text-apple-blue shrink-0">
            {handlerName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-apple-text-secondary">Handled by</p>
            <p className="text-sm font-bold text-apple-text-primary">{handlerName}</p>
          </div>
        </div>
      )}

      {/* ============== Active Orders ============== */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-apple-text-primary tracking-tight">
            Active Orders
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-apple-gray-bg text-apple-text-secondary border border-apple-gray-border">
            {activeOrders.length}
          </span>
        </div>

        {activeOrders.length === 0 ? (
          <EmptyState
            title="No active orders"
            description="Your new requests will appear here once submitted."
          />
        ) : (
          activeOrders.map((request) => {
            const currentStep = getStepIndex(request.status);
            const isProcessing = processingId === request.id;

            return (
              <div
                key={request.id}
                className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-4"
              >
                {/* Order header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={request.status} />
                      {request.branch && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {request.branch.name}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {request.priority?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>
                  {request.total_price !== undefined && request.total_price > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(request.total_price)}
                      </p>
                      {(request.discount_amount ?? 0) > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          Discount: -{formatCurrency(request.discount_amount ?? 0)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-9 min-w-[720px] gap-3">
                    {TIMELINE_STEPS.map((step, index) => {
                      const isDone = currentStep >= index;
                      const isCurrent = request.status === step.key;
                      return (
                        <div key={step.key} className="flex flex-col items-center text-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                              isDone
                                ? 'bg-apple-blue border-apple-blue text-white shadow-sm'
                                : 'bg-white border-apple-gray-border text-apple-text-secondary'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <p
                            className={`text-[10px] font-bold uppercase tracking-tight ${
                              isCurrent ? 'text-apple-blue' : 'text-apple-text-secondary'
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Tracking Card (visible when on_delivery) */}
                {request.status === 'on_delivery' && (() => {
                  const tracking = deliveryTracking[request.id];
                  if (!tracking) return null;
                  const subStatuses: { key: DeliverySubStatus; label: string }[] = [
                    { key: 'otw', label: 'OTW' },
                    { key: 'arrived', label: 'Arrived' },
                    { key: 'delivering', label: 'Delivering' },
                    { key: 'completed', label: 'Completed' },
                  ];
                  const currentIdx = subStatuses.findIndex(s => s.key === tracking.status);
                  return (
                    <div className="rounded-xl bg-apple-blue/5 border border-apple-blue/15 p-4 space-y-3">
                      <p className="text-xs uppercase tracking-wider text-apple-blue font-bold">Delivery Tracking</p>
                      {/* Progress bar */}
                      <div className="flex items-center gap-1 w-full">
                        {subStatuses.map((step, idx) => (
                          <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
                            <div className={`w-full h-2 rounded-full transition-all duration-300 ${idx <= currentIdx ? (idx === currentIdx ? 'bg-apple-blue animate-pulse' : 'bg-apple-blue') : 'bg-gray-200'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${idx <= currentIdx ? 'text-apple-blue' : 'text-apple-text-tertiary'}`}>{step.label}</span>
                          </div>
                        ))}
                      </div>
                      {/* Courier/technician info */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {(tracking.courier?.name || tracking.technician?.name) && (
                          <div>
                            <span className="text-apple-text-secondary text-xs">Courier: </span>
                            <span className="font-semibold text-apple-text-primary">{tracking.courier?.name || tracking.technician?.name}</span>
                          </div>
                        )}
                        {tracking.accompanying_staff && (
                          <div>
                            <span className="text-apple-text-secondary text-xs">Staff: </span>
                            <span className="font-semibold text-apple-text-primary">{tracking.accompanying_staff}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Items */}
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

                {/* Targeted Notes */}
                <OrderNotes
                  requestId={request.id}
                  allowedTargetRoles={['marketing', 'courier', 'warehouse', 'boss', 'finance']}
                  compact
                />

                {/* Delivered actions */}
                {request.status === 'delivered' && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => confirmCompleted(request)}
                      disabled={isProcessing}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? 'Saving...' : 'Confirm Receipt'}
                    </button>
                    <Link
                      href={`/dashboard/client/issues?order_id=${request.id}`}
                      className="px-3 py-2 bg-rose-600/80 hover:bg-rose-700 text-white text-sm rounded-lg transition-colors text-center"
                    >
                      Report Issue
                    </Link>
                  </div>
                )}

                {/* Cancel button */}
                {CANCELLABLE_STATUSES.includes(request.status) && (
                  <button
                    onClick={() => setCancellingRequest(request)}
                    className="w-full py-2 bg-apple-gray-bg hover:bg-apple-gray-border text-apple-danger text-sm font-bold rounded-apple transition-all active:scale-95 border border-apple-gray-border"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* ============== Cancel Modal ============== */}
      <Modal
        isOpen={Boolean(cancellingRequest)}
        onClose={closeCancelModal}
        title="Cancel Request"
        size="sm"
      >
        <p className="text-apple-text-secondary text-sm font-medium mb-6">
          Please tell us why you want to cancel this request.
        </p>

        <div className="space-y-3 mb-6">
          {CANCEL_REASONS.map((reason) => (
            <label
              key={reason}
              className="flex items-center gap-3 p-3 rounded-xl bg-apple-gray-bg border border-apple-gray-border cursor-pointer hover:border-apple-blue/50 transition-all group"
            >
              <input
                type="radio"
                name="cancel_reason"
                value={reason}
                checked={cancelReason === reason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-4 h-4 text-apple-blue focus:ring-apple-blue"
              />
              <span className="text-sm font-bold text-apple-text-primary group-hover:text-apple-blue transition-colors">
                {reason}
              </span>
            </label>
          ))}
        </div>

        {cancelReason === 'Other' && (
          <textarea
            value={cancelOtherReason}
            onChange={(e) => setCancelOtherReason(e.target.value)}
            placeholder="Tell us more..."
            rows={3}
            className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium resize-none mb-6"
          />
        )}

        <div className="flex gap-3">
          <button
            onClick={closeCancelModal}
            className="flex-1 py-3 rounded-xl border border-apple-gray-border font-bold text-xs text-apple-text-secondary hover:bg-apple-gray-bg transition-all active:scale-95"
          >
            KEEP REQUEST
          </button>
          <button
            disabled={!cancelReason || (cancelReason === 'Other' && !cancelOtherReason)}
            onClick={handleCancelRequest}
            className="flex-1 py-3 rounded-xl bg-apple-danger text-white font-black text-xs hover:bg-apple-danger-hover transition-all active:scale-95 shadow-lg shadow-apple-danger/10 disabled:opacity-50"
          >
            CONFIRM CANCEL
          </button>
        </div>
      </Modal>

      {/* ============== History ============== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            {doneOrders.length}
          </span>
        </div>

        {doneOrders.length === 0 ? (
          <EmptyState
            title="No order history"
            description="Completed, resolved, or rejected orders will appear here."
          />
        ) : (
          <div className="space-y-3">
            {doneOrders.map((request) => (
              <div
                key={request.id}
                className="bg-white/60 border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <StatusBadge status={request.status} />
                  <p className="text-sm text-gray-500 mt-2">
                    {(request.request_items || []).length} item(s) &bull;{' '}
                    {formatDate(request.created_at)}
                  </p>

                </div>
                {request.total_price !== undefined && request.total_price > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(request.total_price)}
                    </p>
                    {(request.discount_amount ?? 0) > 0 && (
                      <p className="text-xs text-green-600 font-medium">
                        Disc: -{formatCurrency(request.discount_amount ?? 0)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
