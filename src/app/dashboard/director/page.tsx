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
type EmployeePerformanceData = Awaited<ReturnType<typeof analyticsService.getEmployeePerformance>>;

export default function DirectorDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  
  const [ownerData, setOwnerData] = useState<OwnerDashboardData | null>(null);
  const [empData, setEmpData] = useState<EmployeePerformanceData | null>(null);
  
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/director')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching via service layer ----------
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const [owner, emp] = await Promise.all([
        analyticsService.getOwnerDashboard(),
        analyticsService.getEmployeePerformance()
      ]);
      setOwnerData(owner);
      setEmpData(emp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load director dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    void refresh();
  }, [profile, refresh]);

  // ---------- Realtime subscriptions ----------
  useRealtimeTable('requests', undefined, refresh, { enabled: Boolean(profile), debounceMs: 300 });
  useRealtimeTable('invoices', undefined, refresh, { enabled: Boolean(profile), debounceMs: 300 });

  // ---------- Computed values ----------
  const statCards = useMemo(() => {
    if (!ownerData) return [];
    return [
      { label: 'Total Orders', value: formatNumber(ownerData.stats.totalOrders), color: 'blue' as const },
      { label: 'Total Revenue (Paid)', value: formatCurrency(ownerData.stats.totalRevenue), color: 'green' as const },
      { label: 'Total Products', value: formatNumber(ownerData.stats.totalProducts), color: 'purple' as const },
      { label: 'Open Issues', value: formatNumber(ownerData.stats.openIssues), color: 'red' as const },
    ];
  }, [ownerData]);

  const maxRevenue = useMemo(() => {
    if (!ownerData?.monthlyRevenue.length) return 1;
    return Math.max(...ownerData.monthlyRevenue.map((m) => m.total_revenue), 1);
  }, [ownerData]);

  const totalActions = useMemo(() => {
    if (!empData) return 1;
    let max = 1;
    Object.values(empData.departmentStats).forEach(dept => {
      if (dept.totalActions > max) max = dept.totalActions;
    });
    return max;
  }, [empData]);

  // ---------- Loading state ----------
  if (loading || (fetching && (!ownerData || !empData))) {
    return (
      <div className="mx-auto max-w-7xl">
        <DashboardSkeleton />
      </div>
    );
  }

  // ---------- Error state ----------
  if (error && (!ownerData || !empData)) {
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  if (!ownerData || !empData) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl tracking-tight text-[var(--apple-text-primary)] font-black">
            Director Overview
          </h1>
          <p className="mt-1 text-sm text-[var(--apple-text-secondary)] font-medium">
            High-level metrics, growth, and cross-department performance tracking.
          </p>
        </div>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Monthly Revenue (Growth Metrics) ---------- */}
        <section className="rounded-3xl border border-[var(--apple-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-[var(--apple-text-primary)] tracking-tight">Financial Growth</h2>
          {ownerData.monthlyRevenue.length === 0 ? (
            <EmptyState title="No revenue data" description="Revenue data will appear once invoices are paid." />
          ) : (
            <div className="space-y-4">
              {ownerData.monthlyRevenue.map((row) => {
                const pct = Math.max((row.total_revenue / maxRevenue) * 100, 2);
                return (
                  <div key={row.month} className="flex items-center gap-4 group">
                    <span className="w-20 flex-shrink-0 text-xs font-bold text-[var(--apple-text-tertiary)] group-hover:text-[var(--apple-blue)] transition-colors sm:w-24">
                      {row.month}
                    </span>
                    <div className="relative flex-1">
                      <div
                        className="h-8 rounded-xl bg-[var(--apple-blue)] transition-all duration-700 ease-in-out opacity-90 group-hover:opacity-100"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-28 flex-shrink-0 text-right text-sm font-black text-[var(--apple-text-primary)] sm:w-32 tracking-tight">
                      {formatCurrency(row.total_revenue)}
                    </span>
                    <span className="hidden w-16 flex-shrink-0 text-right text-[10px] font-bold text-[var(--apple-text-tertiary)] md:block uppercase">
                      {row.invoice_count} inv
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------- Department Performance ---------- */}
        <section className="rounded-3xl border border-[var(--apple-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-[var(--apple-text-primary)] tracking-tight">Department Performance</h2>
          {Object.keys(empData.departmentStats).length === 0 ? (
            <EmptyState title="No activity" description="Department metrics will appear as staff perform actions." />
          ) : (
            <div className="space-y-5">
              {Object.entries(empData.departmentStats)
                .sort((a, b) => b[1].totalActions - a[1].totalActions)
                .map(([role, stats]) => {
                const pct = Math.max((stats.totalActions / totalActions) * 100, 2);
                return (
                  <div key={role} className="flex flex-col gap-1.5 group">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold text-[var(--apple-text-primary)] uppercase tracking-wider">{role}</span>
                      <span className="text-xs font-bold text-[var(--apple-text-tertiary)]">{stats.count} Staff</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1 bg-[var(--apple-gray-bg)] rounded-xl h-4 overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full rounded-xl bg-purple-500 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-sm font-black text-[var(--apple-text-primary)]">
                        {formatNumber(stats.totalActions)} <span className="text-[10px] text-[var(--apple-text-tertiary)] uppercase font-bold">ACT</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Order Pipeline ---------- */}
        <section className="rounded-3xl border border-[var(--apple-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-[var(--apple-text-primary)] tracking-tight">Current Order Pipeline</h2>
          {ownerData.orderPipeline.length === 0 ? (
            <EmptyState title="No orders yet" description="Pipeline data will appear once orders are submitted." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--apple-border)]">
                    <th className="pb-3 pr-4 text-[10px] font-black uppercase tracking-widest text-[var(--apple-text-tertiary)]">Status</th>
                    <th className="pb-3 pr-4 text-right text-[10px] font-black uppercase tracking-widest text-[var(--apple-text-tertiary)]">Orders</th>
                    <th className="pb-3 pr-4 text-right text-[10px] font-black uppercase tracking-widest text-[var(--apple-text-tertiary)]">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerData.orderPipeline.map((row) => (
                    <tr key={row.status} className="border-b border-[var(--apple-gray-bg)] last:border-0 hover:bg-[var(--apple-gray-bg)]/50 transition-colors">
                      <td className="py-3 pr-4">
                        <StatusBadge status={row.status as RequestStatus} />
                      </td>
                      <td className="py-3 pr-4 text-right font-black text-[var(--apple-text-primary)]">
                        {formatNumber(row.order_count)}
                      </td>
                      <td className="py-3 pr-4 text-right font-bold text-[var(--apple-text-secondary)]">
                        {formatCurrency(row.total_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------- Top Performing Staff ---------- */}
        <section className="rounded-3xl border border-[var(--apple-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-[var(--apple-text-primary)] tracking-tight">Top Staff Actions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--apple-border)]">
                  <th className="pb-3 pr-4 text-[10px] font-black uppercase tracking-widest text-[var(--apple-text-tertiary)]">Name</th>
                  <th className="pb-3 pr-4 text-[10px] font-black uppercase tracking-widest text-[var(--apple-text-tertiary)]">Role</th>
                  <th className="pb-3 pr-4 text-right text-[10px] font-black uppercase tracking-widest text-[var(--apple-text-tertiary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {empData.employees.slice(0, 7).map((emp) => (
                  <tr key={emp.id} className="border-b border-[var(--apple-gray-bg)] last:border-0">
                    <td className="py-3 pr-4 font-bold text-[var(--apple-text-primary)] shrink-0">
                      {emp.name}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="px-2 py-0.5 rounded bg-[var(--apple-gray-bg)] text-[10px] font-black text-[var(--apple-text-secondary)] uppercase">
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-black text-[var(--apple-text-primary)]">
                      {formatNumber(emp.totalActions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
