'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { ClientType, DbRequest, Profile } from '@/types/types';
import { calculatePriceTotal, fetchProfilesByEmails, getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';

export default function MarketingDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, Profile>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pricingModes, setPricingModes] = useState<Record<string, ClientType>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/marketing')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    if (!profile) return;

    setFetching(true);
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Marketing fetch failed:', error.message);
      setFetching(false);
      return;
    }

    const orders = (data || []) as DbRequest[];
    setRequests(orders);
    setNotes(
      orders.reduce<Record<string, string>>((acc, request) => {
        acc[request.id] = request.marketing_note || '';
        return acc;
      }, {})
    );

    try {
      const profiles = await fetchProfilesByEmails(
        orders.map((request) => request.user_email || '').filter(Boolean)
      );
      const nextProfiles = profiles.reduce<Record<string, Profile>>((acc, item) => {
        acc[item.email] = item;
        return acc;
      }, {});
      setClientProfiles(nextProfiles);
      setPricingModes(
        orders.reduce<Record<string, ClientType>>((acc, request) => {
          const clientType = request.user_email
            ? nextProfiles[request.user_email]?.client_type || 'regular'
            : 'regular';
          acc[request.id] = clientType;
          return acc;
        }, {})
      );
    } catch (profileError) {
      console.error('Marketing profile lookup failed:', profileError);
    }

    setFetching(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('requests', 'status=eq.pending', {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'marketing-pending-requests',
  });

  useRealtimeTable('price_list', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 400,
    channelName: 'marketing-price-list',
  });

  const pricedCount = useMemo(
    () => requests.filter((request) => (request.price_total || 0) > 0).length,
    [requests]
  );

  const saveRequestReview = async (request: DbRequest) => {
    setSavingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      const selectedType = pricingModes[request.id] || 'regular';
      const note = notes[request.id]?.trim() || undefined;
      const priceTotal = await calculatePriceTotal(request.items, selectedType);

      if (!profile?.role) {
  throw new Error('User role not loaded');
}

console.log('MARKETING ROLE:', profile.role);
console.log('TRANSITION pending -> priced');

await workflowEngine.transitionOrder({
  request,
  actorId: actor.id,
  actorEmail: actor.email || profile?.email,
  actorRole: profile.role || 'marketing',
        nextStatus: 'priced',
        action: 'price_request',
        message: `Request ${request.id} priced and ready for boss approval`,
        type: 'info',
        notifyRequester: false,
        notifyRoles: ['boss', 'admin', 'owner'],
        extraUpdates: {
          price_total: priceTotal,
          marketing_note: note,
        },
        metadata: {
          pricing_mode: selectedType,
        },
      });

      setRequests((prev) =>
        prev.filter((item) => item.id !== request.id)
      );
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : 'Failed to save marketing review');
    } finally {
      setSavingId(null);
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-500 text-sm mt-1">
            Price pending client requests before boss approval.
          </p>
        </div>
        <Link
          href="/dashboard/marketing/prices"
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Price List
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-400">{requests.length}</p>
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Priced Orders</p>
          <p className="text-3xl font-bold text-purple-400">{pricedCount}</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-10 text-center text-gray-500">
          No pending requests
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const clientProfile = request.user_email ? clientProfiles[request.user_email] : undefined;
            return (
              <div key={request.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{request.user_email || request.user_id}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(request.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300">
                      PENDING
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {request.priority.toUpperCase()}
                    </span>
                    {clientProfile && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {clientProfile.client_type || 'regular'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
                  <div className="space-y-3">
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
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Pricing Mode
                      </label>
                      <select
                        value={pricingModes[request.id] || 'regular'}
                        onChange={(e) =>
                          setPricingModes((prev) => ({
                            ...prev,
                            [request.id]: e.target.value as ClientType,
                          }))
                        }
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="regular">Regular</option>
                        <option value="kso">KSO</option>
                      </select>
                    </div>

                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Marketing Note
                      </label>
                      <textarea
                        value={notes[request.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                        rows={4}
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none"
                        placeholder="Add a commercial note for boss approval..."
                      />
                    </div>

                    {request.price_total !== undefined && request.price_total > 0 && (
                      <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                        <p className="text-xs uppercase tracking-wider text-purple-300/80 mb-1">
                          Current Price
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          Rp{request.price_total.toLocaleString('id-ID')}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => saveRequestReview(request)}
                      disabled={savingId === request.id}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {savingId === request.id ? 'Saving...' : 'Save Pricing & Notify Boss'}
                    </button>
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
