'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { requestsDb, priceListDb, profilesDb } from '@/lib/db';
import { workflowEngine, authService } from '@/lib/services';
import { formatCurrency, formatDateTime, formatOrderId } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { OrderNotes } from '@/components/ui';
import type { ClientType, DbRequest, DiscountType, PriceList, Profile } from '@/types/types';

export default function MarketingDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, Profile>>({});
  const [priceMap, setPriceMap] = useState<Map<string, PriceList>>(new Map());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pricingModes, setPricingModes] = useState<Record<string, ClientType>>({});
  const [discounts, setDiscounts] = useState<Record<string, { type: DiscountType; value: number; reason: string }>>({});
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, Record<string, number>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/marketing')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching ----------
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);

    try {
      const [requestsResult, allPrices] = await Promise.all([
        requestsDb.getByStatus(['submitted'], undefined, activeBranchId),
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
        const profiles = await profilesDb.getByEmails(uniqueEmails);

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
  }, [profile, activeBranchId]);

  const refreshRequests = useCallback(async () => {
    if (!profile) return;
    try {
      const requestsRes = await requestsDb.getByStatus(['submitted'], undefined, activeBranchId);
      const orders = requestsRes.data;
      setRequests(orders);

      const emails = orders.map((r) => r.user_email).filter((e): e is string => Boolean(e));
      const uniqueEmails = [...new Set(emails)];

      if (uniqueEmails.length > 0) {
        const ObjectProfiles = await profilesDb.getByEmails(uniqueEmails);
        const nextProfiles = ObjectProfiles.reduce<Record<string, Profile>>((acc, p) => {
          acc[p.email] = p;
          return acc;
        }, {});
        setClientProfiles(nextProfiles);

        setPricingModes(orders.reduce<Record<string, ClientType>>((acc, r) => {
          acc[r.id] = r.user_email ? nextProfiles[r.user_email]?.client_type || 'regular' : 'regular';
          return acc;
        }, {}));
      } else {
        setClientProfiles({});
        setPricingModes(orders.reduce<Record<string, ClientType>>((acc, r) => {
          acc[r.id] = 'regular';
          return acc;
        }, {}));
      }

      setNotes(orders.reduce<Record<string, string>>((acc, r) => {
        acc[r.id] = r.note || '';
        return acc;
      }, {}));
    } catch (err) {
      console.error('Failed to refresh requests', err);
    }
  }, [profile, activeBranchId]);

  const refreshPrices = useCallback(async () => {
    if (!profile) return;
    try {
      const allPrices = await priceListDb.getAll();
      const nextPriceMap = new Map<string, PriceList>();
      allPrices.forEach((p: PriceList) => nextPriceMap.set(p.product_id, p));
      setPriceMap(nextPriceMap);
    } catch (err) {
      console.error('Failed to refresh prices', err);
    }
  }, [profile, activeBranchId]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh, activeBranchId]);

  // ---------- Realtime ----------
  useRealtimeTable('requests', 'status=eq.submitted', refreshRequests, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('price_list', undefined, refreshPrices, {
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
      const itemDiscMap = itemDiscounts[request.id] || {};
      
      return items.reduce((sum, item) => {
        const price = priceMap.get(item.product_id);
        if (!price) return sum;
        const unitPrice = clientType === 'kso' ? price.price_kso
          : clientType === 'cost_per_test' ? price.price_cost_per_test
          : price.price_regular;
        
        const discPct = itemDiscMap[item.id] || 0;
        const discountedUnitPrice = unitPrice * (1 - discPct / 100);
        
        return sum + discountedUnitPrice * item.quantity;
      }, 0);
    },
    [priceMap, itemDiscounts]
  );

  // ---------- Discount calculator ----------
  const calculateDiscountAmount = useCallback(
    (totalPrice: number, requestId: string): number => {
      const disc = discounts[requestId];
      if (!disc || disc.value <= 0) return 0;
      if (disc.type === 'percent') {
        const pct = Math.min(disc.value, 100);
        return Math.round(totalPrice * pct / 100);
      }
      return Math.min(disc.value, totalPrice);
    },
    [discounts]
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
        const discountAmount = calculateDiscountAmount(totalPrice, request.id);
        const disc = discounts[request.id];
        const itemDiscMap = itemDiscounts[request.id] || {};

        // Save per-item discounts and prices to request_items (batch)
        if (request.request_items?.length) {
          const { supabase } = await import('@/lib/db/client');
          await Promise.all(request.request_items.map(item => {
            const price = priceMap.get(item.product_id);
            const unitPrice = price
              ? (selectedType === 'kso' ? price.price_kso
                : selectedType === 'cost_per_test' ? price.price_cost_per_test
                : price.price_regular)
              : 0;
            const pct = itemDiscMap[item.id] || 0;
            return supabase.from('request_items').update({
              price_at_order: unitPrice,
              discount_percentage: pct
            }).eq('id', item.id);
          }));
        }

        await workflowEngine.transition({
          request,
          actorId: profile.id,
          actorEmail: profile.email,
          actorRole: role,
          nextStatus: 'priced',
          action: 'price_request',
          message: `Request ${formatOrderId(request.id)} priced${discountAmount > 0 ? ` (discount ${formatCurrency(discountAmount)})` : ''} and ready for boss approval`,
          type: 'info',
          notifyRequester: false,
          notifyRoles: ['boss', 'admin', 'owner'],
          extraUpdates: {
            total_price: totalPrice,
            note,
            ...(discountAmount > 0 && disc ? {
              discount_type: disc.type,
              discount_value: disc.value,
              discount_amount: discountAmount,
              discount_reason: disc.reason || undefined,
              discounted_by: profile.id,
            } : {}),
          },
          metadata: {
            pricing_mode: selectedType,
            ...(discountAmount > 0 ? { discount_amount: discountAmount } : {}),
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
    [profile, role, pricingModes, notes, discounts, calculateTotalPrice, calculateDiscountAmount]
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
                    {request.branch && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {request.branch.name}
                      </span>
                    )}
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
                        {(request.request_items ?? []).map((item, idx) => {
                          const itemName = item.products?.name || item.product_id;
                          return (
                            <div
                              key={`${request.id}-item-${idx}`}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="truncate flex-1" title={itemName}>{itemName}</span>
                              <span className="text-gray-500 shrink-0 w-8 text-right">x{item.quantity}</span>
                              <div className="w-16 shrink-0 relative">
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">%</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={itemDiscounts[request.id]?.[item.id] || ''}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                    setItemDiscounts(prev => ({
                                      ...prev,
                                      [request.id]: {
                                        ...prev[request.id],
                                        [item.id]: val
                                      }
                                    }));
                                  }}
                                  placeholder="Disc"
                                  className="w-full rounded border border-gray-200 py-1 pl-2 pr-5 text-xs outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <OrderNotes
                      requestId={request.id}
                      allowedTargetRoles={['boss', 'client', 'finance', 'warehouse', 'courier']}
                      compact
                    />
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

                    {/* Discount controls */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">
                        Discount (Optional)
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={discounts[request.id]?.type || 'percent'}
                          onChange={(e) =>
                            setDiscounts((prev) => ({
                              ...prev,
                              [request.id]: {
                                ...prev[request.id] || { value: 0, reason: '' },
                                type: e.target.value as DiscountType,
                              },
                            }))
                          }
                          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="percent">Percent %</option>
                          <option value="fixed">Fixed (Rp)</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={discounts[request.id]?.type === 'percent' ? 100 : undefined}
                          value={discounts[request.id]?.value || ''}
                          onChange={(e) =>
                            setDiscounts((prev) => ({
                              ...prev,
                              [request.id]: {
                                ...prev[request.id] || { type: 'percent' as DiscountType, reason: '' },
                                value: Number(e.target.value) || 0,
                              },
                            }))
                          }
                          placeholder="0"
                          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      {(discounts[request.id]?.value ?? 0) > 0 && (
                        <input
                          type="text"
                          value={discounts[request.id]?.reason || ''}
                          onChange={(e) =>
                            setDiscounts((prev) => ({
                              ...prev,
                              [request.id]: {
                                ...prev[request.id],
                                reason: e.target.value,
                              },
                            }))
                          }
                          placeholder="Reason for discount..."
                          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                      )}
                    </div>

                    {/* Price summary */}
                    {computedPrice > 0 && (() => {
                      const discAmt = calculateDiscountAmount(computedPrice, request.id);
                      const finalPrice = computedPrice - discAmt;
                      return (
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600">
                            Price Summary
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm text-gray-600">
                              <span>Subtotal</span>
                              <span>{formatCurrency(computedPrice)}</span>
                            </div>
                            {discAmt > 0 && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>Discount</span>
                                <span>-{formatCurrency(discAmt)}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-blue-200 pt-1 text-lg font-bold text-gray-900">
                              <span>Total</span>
                              <span>{formatCurrency(finalPrice)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

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
