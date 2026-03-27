'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { deliveryService } from '@/lib/delivery-service';
import type { DbRequest, DeliveryLog } from '@/types/types';
import { getCurrentAuthUser } from '@/lib/workflow';

export default function TechnicianDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/technician')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    try {
      const actor = await getCurrentAuthUser();
      const data = await deliveryService.fetchTechnicianDashboardData({
        id: actor.id,
        email: actor.email || profile.email,
        role: profile.role || 'technician',
      });
      setRequests(data.requests);
      setDeliveryLogs(data.deliveryLogs);
    } catch (error) {
      console.error('Technician fetch failed:', error);
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('requests', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'technician-requests',
  });

  useRealtimeTable('delivery_logs', profile?.id ? `technician_id=eq.${profile.id}` : undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `technician-delivery-logs-${profile.id}` : undefined,
  });

  const uploadProof = async (requestId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingId(requestId);
    try {
      const actor = await getCurrentAuthUser();
      const proofUrl = await deliveryService.uploadProof({
        requestId,
        actorId: actor.id,
        file,
      });
      setProofUrls((prev) => ({ ...prev, [requestId]: proofUrl }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Proof upload failed');
    } finally {
      setUploadingId(null);
      event.target.value = '';
    }
  };

  const pickUp = async (request: DbRequest) => {
    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await deliveryService.startDelivery({
        request,
        actor: {
          id: actor.id,
          email: actor.email || profile?.email,
          role: profile?.role || 'technician',
        },
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to start delivery');
    } finally {
      setProcessingId(null);
    }
  };

  const markDelivered = async (request: DbRequest) => {
    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await deliveryService.completeDelivery({
        request,
        actor: {
          id: actor.id,
          email: actor.email || profile?.email,
          role: profile?.role || 'technician',
        },
        proofUrl: proofUrls[request.id] || null,
        note: notes[request.id] || null,
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to mark delivered');
    } finally {
      setProcessingId(null);
    }
  };

  const readyOrders = useMemo(
    () => requests.filter((request) => request.status === 'ready'),
    [requests]
  );
  const inDelivery = useMemo(
    () => requests.filter((request) => request.status === 'on_delivery'),
    [requests]
  );
  const deliveredOrders = useMemo(
    () => requests.filter((request) => request.status === 'delivered'),
    [requests]
  );

  if (loading || fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:min-h-[60vh]">
        <div className="w-12 h-12 sm:w-8 sm:h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm sm:text-base text-center">Loading technician dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-8 sm:mb-0 sm:text-left">
        <h1 className="text-3xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3 tracking-tight">Delivery Dashboard</h1>
        <p className="text-gray-500 text-base sm:text-sm max-w-md mx-auto sm:mx-0">Manage ready jobs, track active deliveries, upload proofs, and view history.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Ready Jobs', value: readyOrders.length, color: 'text-purple-400', icon: '📦' },
          { label: 'Active Delivery', value: inDelivery.length, color: 'text-cyan-400', icon: '🚚' },
          { label: 'Completed Today', value: deliveryLogs.filter(log => {
            const today = new Date();
            today.setHours(0,0,0,0);
            return log.delivered_at && new Date(log.delivered_at) >= today;
          }).length, color: 'text-emerald-400', icon: '✅' },
        ].map((stat) => (
          <div key={stat.label} className="group bg-gradient-to-br from-slate-900/80 to-slate-900 border border-gray-200/50 rounded-2xl p-6 text-center hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 hover:-translate-y-1">
            <div className="text-3xl mb-3 opacity-75">{stat.icon}</div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">{stat.label}</p>
            <p className={`text-3xl sm:text-2xl lg:text-3xl font-black ${stat.color} leading-tight`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-6 lg:space-y-8">
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">📦 Ready Jobs</h2>
            <span className="text-sm text-gray-500">{readyOrders.length} available</span>
          </div>
          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <div className="bg-gradient-to-b from-slate-900/50 to-slate-950 border border-gray-200/50 rounded-2xl p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100/50 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.914a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Ready Jobs</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">All jobs are being processed. Check back soon for new pickups.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {readyOrders.map((request) => (
                  <div 
                    key={request.id} 
                    className="group bg-gradient-to-r from-slate-900 via-slate-900/50 to-slate-950 border border-gray-200/50 hover:border-cyan-500/50 rounded-2xl p-6 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-lg sm:text-base">{request.user_email || request.user_id}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(request.created_at).toLocaleDateString('id-ID')} • {new Date(request.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full sm:self-start sm:ml-auto">
                        {request.priority.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                      {request.items.slice(0, 3).map((item, index) => (
                        <div key={`${request.id}-${index}`} className="flex justify-between items-center py-1">
                          <span className="text-gray-600 font-medium">{item.name || item.id}</span>
                          <span className="text-gray-500 font-bold">x{item.qty}</span>
                        </div>
                      ))}
                      {request.items.length > 3 && (
                        <p className="text-xs text-gray-500">+{request.items.length - 3} more items</p>
                      )}
                    </div>

                    <button
                      onClick={() => pickUp(request)}
                      disabled={processingId === request.id}
                      className="w-full h-14 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-gray-900 text-base font-bold rounded-2xl shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/40 active:scale-[0.97] active:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {processingId === request.id ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Claiming...
                        </>
                      ) : (
                        '🚚 Claim & Start Delivery'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">🚚 My Active Deliveries</h2>
            <span className="text-sm text-gray-500">{inDelivery.length} in progress</span>
          </div>
          <div className="space-y-4">
            {inDelivery.length === 0 ? (
              <div className="bg-gradient-to-b from-slate-900/50 to-slate-950 border border-gray-200/50 rounded-2xl p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100/50 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Active Deliveries</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">Check ready jobs above to start your next delivery.</p>
              </div>
            ) : (
              inDelivery.map((request) => (
                <div 
                  key={request.id} 
                  className="group relative bg-gradient-to-br from-slate-900/70 via-slate-900 to-slate-950/80 border-2 border-gray-200/50 hover:border-emerald-500/50 rounded-2xl p-6 hover:shadow-2xl hover:shadow-emerald-500/15 transition-all duration-300"
                >
                  <div className="absolute top-4 right-4 opacity-75 group-hover:opacity-100 transition-opacity">
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full">
                      ON DELIVERY
                    </span>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6 gap-3">
                    <div>
                      <p className="font-bold text-gray-900 text-lg lg:text-base">{request.user_email || request.user_id}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(request.created_at).toLocaleDateString('id-ID')} • {new Date(request.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full self-start lg:ml-auto lg:self-auto">
                      {request.priority.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-6 pb-6 border-b border-gray-200/50">
                    {request.items.slice(0, 4).map((item, index) => (
                      <div key={`${request.id}-${index}`} className="flex justify-between items-center py-1 px-1">
                        <span className="text-gray-600 font-medium text-sm truncate flex-1 pr-2">{item.name || item.id}</span>
                        <span className="text-gray-500 font-bold text-base min-w-[40px] text-right">×{item.qty}</span>
                      </div>
                    ))}
                    {request.items.length > 4 && (
                      <p className="text-xs text-gray-500 px-1">+{request.items.length - 4} more items</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Proof Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2 tracking-wide uppercase">
                        📸 Delivery Proof Photo
                      </label>
                      <label className="w-full h-20 sm:h-16 flex items-center justify-center bg-gray-100/50 hover:bg-slate-700/50 border-2 border-dashed border-gray-300 hover:border-cyan-500 rounded-2xl cursor-pointer transition-all duration-200 group hover:shadow-lg">
                        {proofUrls[request.id] ? (
                          <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-2 bg-cyan-500/20 rounded-2xl flex items-center justify-center group-hover:bg-cyan-500/30">
                              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364 0L12 13.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </div>
                            <p className="text-xs text-cyan-300 font-medium">Proof uploaded ✓</p>
                          </div>
                        ) : uploadingId === request.id ? (
                          <div className="flex items-center gap-2 text-cyan-400">
                            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium">Uploading...</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-cyan-300 transition-colors">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.588l-6.115-6.115a3 3 0 012.121-5.121 3 3 0 014.242 0 3 3 0 012.121 5.121L12 16.588z" />
                              </svg>
                              <span className="text-sm font-medium">Tap to upload photo</span>
                            </div>
                          </>
                        )}
                        <input
                          id={`proof-${request.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(event) => uploadProof(request.id, event)}
                          className="sr-only"
                        />
                      </label>
                      {proofUrls[request.id] && (
                        <div className="mt-3 pt-3 border-t border-gray-200/50">
                          <a
                            href={proofUrls[request.id]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors group"
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
                      <label className="block text-sm font-semibold text-gray-600 mb-2 tracking-wide uppercase">
                        📝 Delivery Note (optional)
                      </label>
                      <textarea
                        id={`note-${request.id}`}
                        placeholder="e.g. Delivered to front desk, customer signed receipt..."
                        value={notes[request.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                        rows={3}
                        className="w-full min-h-[100px] bg-gray-100/50 border border-gray-300/50 hover:border-slate-600/50 focus:border-emerald-500 focus:bg-gray-100/80 rounded-2xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-vertical transition-all duration-200"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => markDelivered(request)}
                    disabled={processingId === request.id}
                    className="w-full h-16 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800 text-gray-900 text-lg font-bold rounded-3xl shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 active:scale-[0.97] active:shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {processingId === request.id ? (
                      <>
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="font-bold">Completing Delivery...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-black tracking-wide">DELIVERY COMPLETE</span>
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery History</h2>
        {deliveryLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No completed deliveries yet.</p>
        ) : (
          <div className="space-y-3">
            {deliveryLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Order {log.order_id}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {log.delivered_at ? new Date(log.delivered_at).toLocaleString('id-ID') : 'Delivered'}
                  </p>
                  {log.note && (
                    <p className="text-sm text-gray-600 mt-2">{log.note}</p>
                  )}
                </div>
                <div className="text-right space-y-2">
                  {log.proof_url && (
                    <a
                      href={log.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      View proof
                    </a>
                  )}
                  <p className="text-xs text-gray-500">{log.technician_id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {deliveredOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Delivered Orders</h2>
          <div className="space-y-3">
            {deliveredOrders.map((request) => (
              <div key={request.id} className="bg-white/60 border border-gray-200 shadow-sm rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900">{request.user_email || request.user_id}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Delivered {request.delivered_at ? new Date(request.delivered_at).toLocaleString('id-ID') : 'recently'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

