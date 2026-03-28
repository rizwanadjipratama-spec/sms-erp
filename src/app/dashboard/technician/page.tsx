'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { deliveryService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { formatDateTime, formatRelative, formatOrderId } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { DbRequest, DeliveryLog, Actor } from '@/types/types';

export default function TechnicianDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<DbRequest[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/technician')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Build actor helper
  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return {
      id: user.id,
      email: user.email ?? profile?.email,
      role: role,
    };
  }, [profile, role]);

  // Data fetch
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const data = await deliveryService.getTechnicianDashboard(profile.id);
      setOrders(data.orders);
      setDeliveryLogs(data.deliveryLogs);
    } catch (err) {
      console.error('Technician fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // Realtime subscriptions
  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable(
    'delivery_logs',
    profile?.id ? `technician_id=eq.${profile.id}` : undefined,
    refresh,
    { enabled: Boolean(profile?.id), debounceMs: 250 }
  );

  // Handlers
  const uploadProof = useCallback(
    async (requestId: string, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingId(requestId);
      try {
        const actor = await getActor();
        const proofUrl = await deliveryService.uploadProof(file, requestId, actor);
        setProofUrls((prev) => ({ ...prev, [requestId]: proofUrl }));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Proof upload failed');
      } finally {
        setUploadingId(null);
        event.target.value = '';
      }
    },
    [getActor]
  );

  const pickUp = useCallback(
    async (request: DbRequest) => {
      setProcessingId(request.id);
      try {
        const actor = await getActor();
        await deliveryService.startDelivery(request, actor);
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to start delivery');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, refresh]
  );

  const markDelivered = useCallback(
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
        alert(err instanceof Error ? err.message : 'Failed to mark delivered');
      } finally {
        setProcessingId(null);
      }
    },
    [getActor, refresh, proofUrls, notes]
  );

  // Computed values
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  const inDelivery = useMemo(
    () => orders.filter((o) => o.status === 'on_delivery'),
    [orders]
  );

  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === 'delivered'),
    [orders]
  );

  const completedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deliveryLogs.filter(
      (log) => log.delivered_at && new Date(log.delivered_at) >= today
    ).length;
  }, [deliveryLogs]);

  // Loading state
  if (loading || (fetching && orders.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  // Error state
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
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Delivery Dashboard
        </h1>
        <p className="text-gray-500 text-sm max-w-md">
          Manage ready jobs, track active deliveries, upload proofs, and view history.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
          label="Active Delivery"
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

      {/* Ready Jobs Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Ready Jobs
          </h2>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {readyOrders.length} available
          </span>
        </div>

        {readyOrders.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No Ready Jobs"
            description="All jobs are being processed. Check back soon for new pickups."
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {readyOrders.map((request) => (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {request.user_email || request.user_id}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatRelative(request.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                <div className="space-y-1.5 mb-5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {(request.request_items || []).slice(0, 3).map((item, index) => (
                    <div key={`${request.id}-${index}`} className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 font-medium truncate pr-2">
                        {item.products?.name || item.product_id}
                      </span>
                      <span className="text-gray-900 font-bold shrink-0">x{item.quantity}</span>
                    </div>
                  ))}
                  {(request.request_items?.length ?? 0) > 3 && (
                    <p className="text-xs text-gray-400">
                      +{(request.request_items?.length ?? 0) - 3} more items
                    </p>
                  )}
                  {(!request.request_items || request.request_items.length === 0) && (
                    <p className="text-xs text-gray-400 text-center italic">No items found</p>
                  )}
                </div>

                <button
                  onClick={() => pickUp(request)}
                  disabled={processingId === request.id}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === request.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Claim & Start'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Deliveries Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            My Active Deliveries
          </h2>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {inDelivery.length} in progress
          </span>
        </div>

        {inDelivery.length === 0 ? (
          <EmptyState
            icon="🚚"
            title="No Active Deliveries"
            description="Check ready jobs above to start your next delivery."
          />
        ) : (
          <div className="space-y-4">
            {inDelivery.map((request) => (
              <div
                key={request.id}
                className="bg-white border-2 border-gray-200 hover:border-emerald-300 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      {request.user_email || request.user_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={request.status} size="md" />
                    {request.priority === 'cito' && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-full uppercase">
                        {request.priority}
                      </span>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2 mb-6 pb-6 border-b border-gray-100">
                  {(request.request_items || []).slice(0, 4).map((item, index) => (
                    <div key={`${request.id}-${index}`} className="flex justify-between items-center py-1 px-1">
                      <span className="text-gray-600 font-medium text-sm truncate flex-1 pr-2">
                        {item.products?.name || item.product_id}
                      </span>
                      <span className="text-gray-900 font-bold text-base min-w-[40px] text-right">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                  {(request.request_items?.length ?? 0) > 4 && (
                    <p className="text-xs text-gray-500 px-1">
                      +{(request.request_items?.length ?? 0) - 4} more items
                    </p>
                  )}
                  {(!request.request_items || request.request_items.length === 0) && (
                    <p className="text-xs text-gray-400 px-1 italic">No items found</p>
                  )}
                </div>

                {/* Proof Upload */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Delivery Proof Photo
                    </label>
                    <label className="w-full h-20 sm:h-16 flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl cursor-pointer transition-all duration-200">
                      {proofUrls[request.id] ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium">Proof uploaded</span>
                        </div>
                      ) : uploadingId === request.id ? (
                        <div className="flex items-center gap-2 text-blue-500">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm font-medium">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-500">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm font-medium">Tap to upload photo</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => uploadProof(request.id, event)}
                        className="sr-only"
                      />
                    </label>
                    {proofUrls[request.id] && (
                      <div className="mt-2">
                        <a
                          href={proofUrls[request.id]}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View proof photo
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Delivery Note */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Delivery Note (optional)
                    </label>
                    <textarea
                      placeholder="e.g. Delivered to front desk, customer signed receipt..."
                      value={notes[request.id] || ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                      }
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-200 hover:border-gray-300 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-vertical transition-all"
                    />
                  </div>
                </div>

                {/* Complete Button */}
                <button
                  onClick={() => markDelivered(request)}
                  disabled={processingId === request.id}
                  className="w-full mt-4 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delivery History */}
      <section className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery History</h2>
        {deliveryLogs.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No Delivery History"
            description="No completed deliveries yet."
          />
        ) : (
          <div className="space-y-3">
            {deliveryLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Order {formatOrderId(log.order_id)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {log.delivered_at ? formatDateTime(log.delivered_at) : 'Delivered'}
                  </p>
                  {log.note && (
                    <p className="text-sm text-gray-600 mt-2">{log.note}</p>
                  )}
                </div>
                <div className="text-right space-y-1">
                  {log.proof_url && (
                    <a
                      href={log.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View proof
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delivered Orders */}
      {deliveredOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Delivered Orders</h2>
          <div className="space-y-3">
            {deliveredOrders.map((request) => (
              <div
                key={request.id}
                className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {request.user_email || request.user_id}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
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
