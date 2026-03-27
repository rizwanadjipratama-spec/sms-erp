'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { DbRequest, RequestStatus } from '@/types/types';
import { ACTIVE_ORDER_STATUSES, getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-apple-warning/10 text-apple-warning',
  priced: 'bg-apple-blue/10 text-apple-blue',
  approved: 'bg-apple-blue/20 text-apple-blue',
  invoice_ready: 'bg-apple-blue/30 text-apple-blue',
  preparing: 'bg-apple-warning/20 text-apple-warning',
  ready: 'bg-apple-success/10 text-apple-success',
  on_delivery: 'bg-apple-blue/10 text-apple-blue',
  delivered: 'bg-apple-success/20 text-apple-success',
  completed: 'bg-apple-success/30 text-apple-success',
  rejected: 'bg-apple-danger/10 text-apple-danger',
  issue: 'bg-apple-danger/20 text-apple-danger',
  resolved: 'bg-apple-success/40 text-apple-success',
};

const TIMELINE_STEPS: Array<{ key: RequestStatus; label: string }> = [
  { key: 'pending', label: 'Submitted' },
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

export default function ClientDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState<DbRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherReason, setCancelOtherReason] = useState('');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/client')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    const actor = await getCurrentAuthUser();
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', actor.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Client fetch failed:', error.message);
    } else {
      setRequests((data || []) as DbRequest[]);
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('requests', profile?.id ? `user_id=eq.${profile.id}` : undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `client-requests-${profile.id}` : undefined,
  });

  useRealtimeTable('issues', profile?.id ? `reported_by=eq.${profile.id}` : undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `client-issues-${profile.id}` : undefined,
  });

  useRealtimeTable('notifications', profile?.id ? `user_id=eq.${profile.id}` : undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `client-notifications-${profile.id}` : undefined,
  });

  const activeOrders = useMemo(
    () => requests.filter((request) => ACTIVE_ORDER_STATUSES.includes(request.status)),
    [requests]
  );
  const doneOrders = useMemo(
    () => requests.filter((request) => ['completed', 'resolved', 'rejected'].includes(request.status)),
    [requests]
  );

  const confirmCompleted = async (request: DbRequest) => {
    if (!profile?.role) {
      alert('User role not loaded');
      return;
    }

    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();

      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: profile.role,
        nextStatus: 'completed',
        action: 'complete_request',
        message: `Request ${request.id} completed by client`,
        notifyRoles: ['admin', 'owner'],
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to confirm receipt');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancellingRequest || !profile) return;
    
    const finalReason = cancelReason === 'Other' ? cancelOtherReason : cancelReason;
    if (!finalReason) {
      alert('Please select or specify a reason');
      return;
    }

    setProcessingId(cancellingRequest.id);
    try {
      const actor = await getCurrentAuthUser();
      await workflowEngine.transitionOrder({
        request: cancellingRequest,
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: profile.role,
        nextStatus: 'cancelled',
        action: 'cancel_request',
        message: `Request ${cancellingRequest.id} cancelled by client. Reason: ${finalReason}`,
        notifyRoles: ['admin', 'owner', 'marketing'],
        extraUpdates: {
          cancel_reason: finalReason
        }
      });
      setCancellingRequest(null);
      setCancelReason('');
      setCancelOtherReason('');
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">My Orders</h1>
          <p className="text-apple-text-secondary text-sm mt-1">Track your full request lifecycle in one place.</p>
        </div>
        <Link
          href="/request"
          className="bg-apple-blue hover:bg-apple-blue-hover text-white text-sm font-bold px-6 py-2 rounded-apple transition-all active:scale-95 shadow-sm"
        >
          New Request
        </Link>
      </div>

      {profile && profile.debt_amount > profile.debt_limit && (
        <div className="bg-apple-danger/5 border border-apple-danger/20 rounded-apple p-4 flex items-center gap-3">
          <div className="text-apple-danger text-xl">⚠️</div>
          <div>
            <p className="text-apple-danger font-bold text-sm">Debt limit exceeded</p>
            <p className="text-apple-text-secondary text-xs mt-0.5">
              Current debt Rp{profile.debt_amount.toLocaleString('id-ID')} • limit Rp{profile.debt_limit.toLocaleString('id-ID')}.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-apple-text-primary tracking-tight">Active Orders</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-apple-gray-bg text-apple-text-secondary border border-apple-gray-border">{activeOrders.length}</span>
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 text-center text-gray-500">
            No active orders
          </div>
        ) : (
          activeOrders.map((request) => {
            const currentStep = getStepIndex(request.status);
            return (
              <div key={request.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[request.status] || 'bg-slate-700 text-gray-600'}`}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {request.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(request.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  {request.price_total !== undefined && request.price_total > 0 && (
                    <p className="text-sm font-semibold text-gray-900">
                      Rp{request.price_total.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <div className="grid grid-cols-9 min-w-[720px] gap-3">
                    {TIMELINE_STEPS.map((step, index) => {
                      const isDone = currentStep >= index;
                      const isCurrent = request.status === step.key;
                      return (
                        <div key={step.key} className="flex flex-col items-center text-center gap-2">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                            isDone
                              ? 'bg-apple-blue border-apple-blue text-white shadow-sm'
                              : 'bg-white border-apple-gray-border text-apple-text-secondary'
                          }`}>
                            {index + 1}
                          </div>
                          <p className={`text-[10px] font-bold uppercase tracking-tight ${isCurrent ? 'text-apple-blue' : 'text-apple-text-secondary'}`}>{step.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Items</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    {request.items.map((item, index) => (
                      <div key={`${request.id}-${index}`} className="flex justify-between gap-3">
                        <span>{item.name || item.id}</span>
                        <span className="text-gray-500">x{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {request.rejection_reason && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200">
                    Rejection reason: {request.rejection_reason}
                  </div>
                )}

                {request.status === 'delivered' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => confirmCompleted(request)}
                      disabled={processingId === request.id}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {processingId === request.id ? 'Saving...' : 'Confirm Receipt'}
                    </button>
                    <Link
                      href={`/dashboard/client/issues?order_id=${request.id}`}
                      className="px-3 py-2 bg-rose-600/80 hover:bg-rose-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Report Issue
                    </Link>
                  </div>
                )}

                {['pending', 'priced', 'approved'].includes(request.status) && (
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

      {cancellingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setCancellingRequest(null)} />
          <div className="bg-white rounded-[2rem] border border-apple-gray-border shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 slide-in-from-bottom-5 duration-500">
            <div className="p-8">
              <h2 className="text-xl font-black text-apple-text-primary tracking-tight mb-2">Cancel Request</h2>
              <p className="text-apple-text-secondary text-sm font-medium mb-6">Please tell us why you want to cancel this request.</p>
              
              <div className="space-y-3 mb-6">
                {['Wrong item', 'Change plan', 'Ordered by mistake', 'Need revision', 'Other'].map(reason => (
                  <label key={reason} className="flex items-center gap-3 p-3 rounded-xl bg-apple-gray-bg border border-apple-gray-border cursor-pointer hover:border-apple-blue/50 transition-all group">
                    <input 
                      type="radio" 
                      name="cancel_reason" 
                      value={reason} 
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-4 h-4 text-apple-blue focus:ring-apple-blue"
                    />
                    <span className="text-sm font-bold text-apple-text-primary group-hover:text-apple-blue transition-colors">{reason}</span>
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
                  onClick={() => setCancellingRequest(null)}
                  className="flex-1 py-3 rounded-xl border border-apple-gray-border font-bold text-xs text-apple-text-secondary hover:bg-apple-gray-bg transition-all active:scale-95"
                >
                  KEEP REQUEST
                </button>
                <button
                  disabled={!cancelReason || (cancelReason === 'Other' && !cancelOtherReason)}
                  onClick={handleCancelRequest}
                  className="flex-1 py-3 rounded-xl bg-apple-danger text-white font-black text-xs hover:bg-apple-danger-hover transition-all active:scale-95 shadow-lg shadow-apple-danger/10"
                >
                  CONFIRM CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{doneOrders.length}</span>
        </div>
        {doneOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 text-center text-gray-500">
            Completed, resolved, or rejected orders will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {doneOrders.map((request) => (
              <div key={request.id} className="bg-white/60 border border-gray-200 shadow-sm rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[request.status] || 'bg-slate-700 text-gray-600'}`}>
                    {request.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <p className="text-sm text-gray-500 mt-2">
                    {request.items.length} item(s) • {new Date(request.created_at).toLocaleDateString('id-ID')}
                  </p>
                  {request.rejection_reason && (
                    <p className="text-xs text-red-400 mt-1">Reason: {request.rejection_reason}</p>
                  )}
                </div>
                {request.price_total !== undefined && request.price_total > 0 && (
                  <p className="text-sm font-medium text-gray-900">Rp{request.price_total.toLocaleString('id-ID')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
