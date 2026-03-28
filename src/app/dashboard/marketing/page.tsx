'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { requestsDb, priceListDb, profilesDb } from '@/lib/db';
import { workflowEngine } from '@/lib/services';
import { formatCurrency, formatDateTime, formatOrderId } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { ClientType, DbRequest, PriceList, Profile } from '@/types/types';

export default function MarketingDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, Profile>>({});
  const [priceMap, setPriceMap] = useState<Map<string, PriceList>>(new Map());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pricingModes, setPricingModes] = useState<Record<string, ClientType>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/marketing')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching ----------
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);

    try {
      const [requestsResult, allPrices] = await Promise.all([
        requestsDb.getByStatus(['submitted']),
        priceListDb.getAll(),
      ]);

      const orders = requestsResult.data;
      setRequests(orders);

      // Build price lookup map
      const nextPriceMap = new Map<string, PriceList>();
      allPrices.forEach((p) => nextPriceMap.set(p.product_id, p));
      setPriceMap(nextPriceMap);

      // Initialize notes from existing request data
      setNotes(
        orders.reduce<Record<string, string>>((acc, r) => {
          acc[r.id] = r.note || '';
          return acc;
        }, {})
      );

      // Fetch client profiles
      const emails = orders
        .map((r) => r.user_email)
        .filter((e): e is string => Boolean(e));
      const uniqueEmails = [...new Set(emails)];

      if (uniqueEmails.length > 0) {
        const profiles: Profile[] = [];
        for (const email of uniqueEmails) {
          const p = await profilesDb.getByEmail(email);
          if (p) profiles.push(p);
        }

        const nextProfiles = profiles.reduce<Record<string, Profile>>((acc, p) => {
          acc[p.email] = p;
          return acc;
        }, {});
        setClientProfiles(nextProfiles);

        // Set pricing modes based on client type
        setPricingModes(
          orders.reduce<Record<string, ClientType>>((acc, r) => {
            const ct = r.user_email
              ? nextProfiles[r.user_email]?.client_type || 'regular'
              : 'regular';
            acc[r.id] = ct;
            return acc;
          }, {})
        );
      } else {
        setClientProfiles({});
        setPricingModes(
          orders.reduce<Record<string, ClientType>>((acc, r) => {
            acc[r.id] = 'regular';
            return acc;
          }, {})
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketing data');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // ---------- Realtime ----------
  useRealtimeTable('requests', 'status=eq.submitted', refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('price_list', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  // ---------- Computed ----------
  const pricedCount = useMemo(
    () => requests.filter((r) => (r.total_price || 0) > 0).length,
    [requests]
  );

  const calculateTotalPrice = useCallback(
    (request: DbRequest, clientType: ClientType): number => {
      const items = request.request_items ?? [];
      return items.reduce((sum, item) => {
        const price = priceMap.get(item.product_id);
        if (!price) return sum;
        const unitPrice = clientType === 'kso' ? price.price_kso : price.price_regular;
        return sum + unitPrice * item.quantity;
      }, 0);
    },
    [priceMap]
  );

  // ---------- Handlers ----------
  const handleSaveReview = useCallback(
    async (request: DbRequest) => {
      if (!profile) return;
      setSavingId(request.id);

      try {
        const selectedType = pricingModes[request.id] || 'regular';
        const note = notes[request.id]?.trim() || undefined;
        const totalPrice = calculateTotalPrice(request, selectedType);

        await workflowEngine.transition({
          request,
          actorId: profile.id,
          actorEmail: profile.email,
          actorRole: role,
          nextStatus: 'priced',
          action: 'price_request',
          message: `Request ${formatOrderId(request.id)} priced and ready for boss approval`,
          type: 'info',
          notifyRequester: false,
          notifyRoles: ['boss', 'admin', 'owner'],
          extraUpdates: {
            total_price: totalPrice,
            note,
          },
          metadata: {
            pricing_mode: selectedType,
          },
        });

        // Remove from local state immediately
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to save marketing review');
      } finally {
        setSavingId(null);
      }
    },
    [profile, role, pricingModes, notes, calculateTotalPrice]
  );

  // ---------- Render: loading ----------
  if (loading || fetching) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  // ---------- Render: error ----------
  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  // ---------- Render: main ----------
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Marketing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Price submitted client requests before boss approval.
          </p>
        </div>
        <Link
          href="/dashboard/marketing/prices"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-95"
        >
          Price List
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Submitted Review" value={requests.length} color="yellow" />
        <StatCard label="Priced Orders" value={pricedCount} color="blue" />
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="All submitted requests have been priced. Check back later for new submissions."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const clientProfile = request.user_email
              ? clientProfiles[request.user_email]
              : undefined;
            const selectedType = pricingModes[request.id] || 'regular';
            const computedPrice = calculateTotalPrice(request, selectedType);

            return (
              <div
                key={request.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
              >
                {/* Header row */}
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {request.user_email || formatOrderId(request.id)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={request.status} />
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 uppercase">
                      {request.priority}
                    </span>
                    {clientProfile?.client_type && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 uppercase">
                        {clientProfile.client_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content grid */}
                <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                  {/* Left: items & note */}
                  <div className="space-y-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                        Items
                      </p>
                      <div className="space-y-2 text-sm text-gray-700">
                        {(request.request_items ?? []).map((item, idx) => (
                          <div
                            key={`${request.id}-item-${idx}`}
                            className="flex justify-between gap-3"
                          >
                            <span>{item.products?.name || item.product_id}</span>
                            <span className="text-gray-500">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {request.note && (
                      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                        Note: {request.note}
                      </div>
                    )}
                  </div>

                  {/* Right: pricing controls */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">
                        Pricing Mode
                      </label>
                      <select
                        value={selectedType}
                        onChange={(e) =>
                          setPricingModes((prev) => ({
                            ...prev,
                            [request.id]: e.target.value as ClientType,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="regular">Regular</option>
                        <option value="kso">KSO</option>
                      </select>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">
                        Marketing Note
                      </label>
                      <textarea
                        value={notes[request.id] || ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                        rows={4}
                        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Add a commercial note for boss approval..."
                      />
                    </div>

                    {computedPrice > 0 && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600">
                          Calculated Price
                        </p>
                        <p className="text-lg font-bold tracking-tight text-gray-900">
                          {formatCurrency(computedPrice)}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => handleSaveReview(request)}
                      disabled={savingId === request.id}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
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
