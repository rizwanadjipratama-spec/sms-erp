'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { DbRequest, Profile } from '@/types/types';
import { fetchProfilesByEmails, getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';

export default function BossDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, Profile>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/boss')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    if (!profile) return;

    setFetching(true);
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'priced')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Boss fetch failed:', error.message);
      setFetching(false);
      return;
    }

    const pricedRequests = (data || []) as DbRequest[];
    setRequests(pricedRequests);

    try {
      const profiles = await fetchProfilesByEmails(
        pricedRequests.map((request) => request.user_email || '').filter(Boolean)
      );
      setClientProfiles(
        profiles.reduce<Record<string, Profile>>((acc, item) => {
          acc[item.email] = item;
          return acc;
        }, {})
      );
    } catch (profileError) {
      console.error('Boss profile lookup failed:', profileError);
    }

    setFetching(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('requests', 'status=eq.priced', {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'boss-priced-requests',
  });

  const pendingCount = useMemo(() => requests.length, [requests]);

  const approve = async (request: DbRequest) => {
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile.role,
        nextStatus: 'approved',
        action: 'approve',
        message: `Request ${request.id} approved`,
        type: 'success',
        notifyRoles: ['finance', 'admin', 'owner'],
        metadata: {
          previous_status: request.status,
          price_total: request.price_total || 0,
        },
      });
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async (request: DbRequest) => {
    const reason = rejectionReason[request.id]?.trim();
    if (!reason) {
      alert('Rejection reason is required');
      return;
    }

    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile.role,
        nextStatus: 'rejected',
        action: 'reject',
        message: `Request ${request.id} rejected`,
        type: 'error',
        notifyRoles: ['admin', 'owner'],
        extraUpdates: {
          rejection_reason: reason,
        },
        metadata: {
          previous_status: request.status,
          rejection_reason: reason,
        },
      });
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">Boss Approval Queue</h1>
        <p className="text-apple-text-secondary text-sm mt-1">
          {pendingCount} pending request{pendingCount === 1 ? '' : 's'} awaiting a decision.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-12 text-center">
          <p className="text-gray-900 font-medium">No pending approvals</p>
          <p className="text-gray-500 text-sm mt-1">Marketing and client requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {requests.map((request) => {
            const clientProfile = request.user_email ? clientProfiles[request.user_email] : undefined;
            const debtExceeded =
              clientProfile &&
              (clientProfile.debt_amount || 0) > (clientProfile.debt_limit || 0);

            return (
              <div key={request.id} className="bg-white border border-apple-gray-border rounded-apple p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                  <div>
                    <p className="font-semibold text-apple-text-primary">{request.user_email || request.user_id}</p>
                    <p className="text-xs text-apple-text-secondary mt-1 font-medium">
                      {new Date(request.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 bg-apple-blue-light text-apple-blue rounded-full uppercase tracking-wider">
                      PRICED
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 bg-apple-gray-bg text-apple-text-secondary rounded-full uppercase tracking-wider">
                      {request.priority.toUpperCase()}
                    </span>
                    {clientProfile && (
                      <span className="text-[10px] font-bold px-2 py-1 bg-apple-gray-bg text-apple-text-secondary rounded-full uppercase tracking-wider">
                        {clientProfile.client_type || 'regular'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
                  <div className="space-y-4">
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

                    {request.reason && (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200">
                        Client note: {request.reason}
                      </div>
                    )}

                    {request.marketing_note && (
                      <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                        <p className="text-xs uppercase tracking-wider text-purple-300/80 mb-1">Marketing Note</p>
                        <p className="text-sm text-purple-100">{request.marketing_note}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Commercial Summary</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {request.price_total && request.price_total > 0
                          ? `Rp${request.price_total.toLocaleString('id-ID')}`
                          : 'Price not set'}
                      </p>
                    </div>

                    {clientProfile && (
                      <div className={`rounded-xl border p-4 ${debtExceeded ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-950/60 border-gray-200'}`}>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Client Debt</p>
                        <p className="text-sm text-gray-900">
                          Rp{(clientProfile.debt_amount || 0).toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Limit: Rp{(clientProfile.debt_limit || 0).toLocaleString('id-ID')}
                        </p>
                        {debtExceeded && (
                          <p className="text-xs text-amber-300 mt-2">
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
                        disabled={processingId === request.id}
                        className="flex-1 py-2.5 bg-apple-success hover:bg-apple-success/90 text-white text-sm font-semibold rounded-apple transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      >
                        {processingId === request.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => reject(request)}
                        disabled={processingId === request.id}
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
