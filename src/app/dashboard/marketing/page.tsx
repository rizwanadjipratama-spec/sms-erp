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
import { formatCurrency } from '@/lib/format-utils';

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
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setSavingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      if (!actor) {
        alert('Actor profile not loaded');
        return;
      }

      const selectedType = pricingModes[request.id] || 'regular';
      const note = notes[request.id]?.trim() || undefined;
      const priceTotal = await calculatePriceTotal(request.items, selectedType);

      console.log('MARKETING ROLE:', profile.role);
      console.log('ACTOR ROLE:', actor.role);
      console.log('TRANSITION pending -> priced');

      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile.role,
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">Marketing</h1>
          <p className="text-apple-text-secondary text-sm mt-1">
            Price pending client requests before boss approval.
          </p>
        </div>
        <Link
          href="/dashboard/marketing/prices"
          className="bg-apple-blue hover:bg-apple-blue-hover text-white text-sm font-medium px-4 py-2 rounded-apple transition-all active:scale-95 shadow-sm"
        >
          Price List
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-apple-gray-border rounded-apple p-5 shadow-sm">
          <p className="text-apple-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1">Pending Review</p>
          <p className="text-3xl font-bold text-apple-warning">{requests.length}</p>
        </div>
        <div className="bg-white border border-apple-gray-border rounded-apple p-5 shadow-sm">
          <p className="text-apple-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1">Priced Orders</p>
          <p className="text-3xl font-bold text-apple-blue">{pricedCount}</p>
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
              <div key={request.id} className="bg-white border border-apple-gray-border rounded-apple p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                  <div>
                    <p className="text-sm font-semibold text-apple-text-primary">{request.user_email || request.user_id}</p>
                    <p className="text-xs text-apple-text-secondary mt-1 font-medium">
                      {new Date(request.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-apple-warning/10 text-apple-warning uppercase tracking-wider">
                      PENDING
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-apple-gray-bg text-apple-text-secondary uppercase tracking-wider">
                      {request.priority.toUpperCase()}
                    </span>
                    {clientProfile && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-apple-blue-light text-apple-blue uppercase tracking-wider">
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
                    <div className="rounded-apple bg-apple-gray-bg border border-apple-gray-border p-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-apple-text-secondary mb-2">
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
                        className="w-full bg-white border border-apple-gray-border rounded-lg px-3 py-2 text-sm text-apple-text-primary focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none transition-all"
                      >
                        <option value="regular">Regular</option>
                        <option value="kso">KSO</option>
                      </select>
                    </div>

                    <div className="rounded-apple bg-apple-gray-bg border border-apple-gray-border p-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-apple-text-secondary mb-2">
                        Marketing Note
                      </label>
                      <textarea
                        value={notes[request.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                        rows={4}
                        className="w-full bg-white border border-apple-gray-border rounded-lg px-3 py-2 text-sm text-apple-text-primary placeholder-apple-text-secondary/50 focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none transition-all resize-none"
                        placeholder="Add a commercial note for boss approval..."
                      />
                    </div>

                    {request.price_total !== undefined && request.price_total > 0 && (
                      <div className="rounded-apple bg-apple-blue/5 border border-apple-blue/10 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-apple-blue/80 mb-1">
                          Current Price
                        </p>
                        <p className="text-lg font-bold text-apple-text-primary tracking-tight">
                          {formatCurrency(request.price_total)}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => saveRequestReview(request)}
                      disabled={savingId === request.id}
                      className="w-full py-2.5 bg-apple-blue hover:bg-apple-blue-hover text-white text-sm font-semibold rounded-apple transition-all active:scale-95 shadow-sm disabled:opacity-50"
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
