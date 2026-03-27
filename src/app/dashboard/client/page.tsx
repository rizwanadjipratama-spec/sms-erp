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
  pending: 'bg-yellow-500/20 text-yellow-300',
  priced: 'bg-fuchsia-500/20 text-fuchsia-300',
  approved: 'bg-blue-500/20 text-blue-300',
  invoice_ready: 'bg-cyan-500/20 text-cyan-300',
  preparing: 'bg-orange-500/20 text-orange-300',
  ready: 'bg-purple-500/20 text-purple-300',
  on_delivery: 'bg-indigo-500/20 text-indigo-300',
  delivered: 'bg-green-500/20 text-green-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
  issue: 'bg-rose-500/20 text-rose-300',
  resolved: 'bg-teal-500/20 text-teal-300',
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
    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile?.role || 'client',
        nextStatus: 'completed',
        action: 'completed',
        message: `Client confirmed receipt for request ${request.id}`,
        type: 'success',
        notifyRoles: ['finance', 'admin', 'owner'],
        metadata: {
          previous_status: request.status,
        },
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to confirm receipt');
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
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Track your full request lifecycle in one place.</p>
        </div>
        <Link
          href="/request"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          New Request
        </Link>
      </div>

      {profile && profile.debt_amount > profile.debt_limit && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-300 font-medium text-sm">Debt limit exceeded</p>
          <p className="text-amber-400 text-xs mt-1">
            Current debt Rp{profile.debt_amount.toLocaleString('id-ID')} • limit Rp{profile.debt_limit.toLocaleString('id-ID')}.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Active Orders</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{activeOrders.length}</span>
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
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-semibold ${
                            isDone
                              ? 'bg-indigo-500 border-indigo-500 text-white'
                              : 'bg-white border-gray-200 shadow-sm border-gray-300 text-gray-500'
                          }`}>
                            {index + 1}
                          </div>
                          <p className={`text-[11px] ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>{step.label}</p>
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
              </div>
            );
          })
        )}
      </section>

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
