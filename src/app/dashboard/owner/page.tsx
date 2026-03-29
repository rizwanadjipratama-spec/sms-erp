'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { analyticsService, authService } from '@/lib/services';
import { formatCurrency, formatNumber } from '@/lib/format-utils';
import { DashboardSkeleton, StatCard, EmptyState, ErrorState, StatusBadge } from '@/components/ui';
import type { RequestStatus } from '@/types/types';

type OwnerDashboardData = Awaited<ReturnType<typeof analyticsService.getOwnerDashboard>>;

export default function OwnerDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<OwnerDashboardData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/owner')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching via service layer ----------
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const data = await analyticsService.getOwnerDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    void refresh();
  }, [profile, refresh]);

  // ---------- Realtime subscriptions ----------
  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 300,
  });

  useRealtimeTable('invoices', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 300,
  });

  useRealtimeTable('products', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('issues', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 300,
  });

  // ---------- Computed values ----------
  const statCards = useMemo(() => {
    if (!dashboard) return [];
    return [
      { label: 'Total Orders', value: formatNumber(dashboard.stats.totalOrders), color: 'blue' as const },
      { label: 'Total Revenue (Paid)', value: formatCurrency(dashboard.stats.totalRevenue), color: 'green' as const },
      { label: 'Total Products', value: formatNumber(dashboard.stats.totalProducts), color: 'purple' as const },
      { label: 'Open Issues', value: formatNumber(dashboard.stats.openIssues), color: 'red' as const },
      { label: 'Paid Invoices', value: formatNumber(dashboard.stats.paidInvoices), color: 'green' as const },
      { label: 'Unpaid Invoices', value: formatNumber(dashboard.stats.unpaidInvoices), color: 'yellow' as const },
    ];
  }, [dashboard]);

  const maxRevenue = useMemo(() => {
    if (!dashboard?.monthlyRevenue.length) return 1;
    return Math.max(...dashboard.monthlyRevenue.map((m) => m.total_revenue), 1);
  }, [dashboard]);

  // ---------- Loading state ----------
  if (loading || (fetching && !dashboard)) {
    return (
      <div className="mx-auto max-w-7xl">
        <DashboardSkeleton />
      </div>
    );
  }

  // ---------- Error state ----------
  if (error && !dashboard) {
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Owner Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Executive-level visibility across revenue, operations, and fulfillment.
          </p>
        </div>
        <Link
          href="/dashboard/owner/reports"
          className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-95"
        >
          View Reports
        </Link>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      {/* ---------- Monthly Revenue (bar chart using divs) ---------- */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Monthly Revenue</h2>
        {dashboard.monthlyRevenue.length === 0 ? (
          <EmptyState title="No revenue data" description="Revenue data will appear once invoices are paid." />
        ) : (
          <div className="space-y-3">
            {dashboard.monthlyRevenue.map((row) => {
              const pct = Math.max((row.total_revenue / maxRevenue) * 100, 2);
              return (
                <div key={row.month} className="flex items-center gap-4">
                  <span className="w-20 flex-shrink-0 text-xs font-medium text-gray-500 sm:w-24">
                    {row.month}
                  </span>
                  <div className="relative flex-1">
                    <div
                      className="h-7 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-28 flex-shrink-0 text-right text-sm font-bold text-gray-900 sm:w-32">
                    {formatCurrency(row.total_revenue)}
                  </span>
                  <span className="hidden w-20 flex-shrink-0 text-right text-xs text-gray-400 md:block">
                    {row.invoice_count} inv
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Order Pipeline & Top Products ---------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Order Pipeline */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Order Pipeline</h2>
          {dashboard.orderPipeline.length === 0 ? (
            <EmptyState title="No orders yet" description="Pipeline data will appear once orders are submitted." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Orders</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                    <th className="hidden pb-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">Avg Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.orderPipeline.map((row) => (
                    <tr key={row.status} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={row.status as RequestStatus} />
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-gray-900">
                        {formatNumber(row.order_count)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-700">
                        {formatCurrency(row.total_value)}
                      </td>
                      <td className="hidden py-2.5 text-right text-gray-500 sm:table-cell">
                        {row.avg_hours_in_status > 0 ? `${row.avg_hours_in_status.toFixed(1)}h` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top Products */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Products</h2>
          {dashboard.productPerformance.length === 0 ? (
            <EmptyState title="No product data" description="Performance data appears as orders are fulfilled." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Ordered</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
                    <th className="hidden pb-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.productPerformance.map((prod) => (
                    <tr key={prod.id} className="border-b border-gray-50 last:border-0">
                      <td className="max-w-[160px] truncate py-2.5 pr-4 font-medium text-gray-900 sm:max-w-[220px]">
                        {prod.name}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-700">
                        {formatNumber(prod.total_ordered)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-emerald-600">
                        {formatCurrency(prod.total_revenue)}
                      </td>
                      <td className="hidden py-2.5 text-right text-gray-500 sm:table-cell">
                        {formatNumber(prod.stock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ---------- Technician Performance ---------- */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Technician Performance</h2>
        {dashboard.technicianPerformance.length === 0 ? (
          <EmptyState title="No technician data" description="Delivery data will appear once technicians complete deliveries." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Technician</th>
                  <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>
                  <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Successful</th>
                  <th className="hidden pb-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">Avg Hours</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.technicianPerformance.map((tech) => (
                  <tr key={tech.technician_id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">
                      {tech.technician_name || 'Unknown'}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-700">
                      {formatNumber(tech.total_deliveries)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-emerald-600">
                      {formatNumber(tech.successful_deliveries)}
                    </td>
                    <td className="hidden py-2.5 text-right text-gray-500 sm:table-cell">
                      {tech.avg_delivery_hours > 0 ? `${tech.avg_delivery_hours.toFixed(1)}h` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
