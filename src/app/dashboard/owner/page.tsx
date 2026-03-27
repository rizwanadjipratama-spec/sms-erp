'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import {
  getOwnerDashboardBundle,
} from '@/lib/analytics-service';
import { canAccessRoute } from '@/lib/permissions';
type OwnerDashboardData = Awaited<ReturnType<typeof getOwnerDashboardBundle>>;

export default function OwnerDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<OwnerDashboardData | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/owner')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    if (!profile) return;

    setFetching(true);
    setDashboard(await getOwnerDashboardBundle());
    setFetching(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timer);
  }, [profile, refresh]);

  useRealtimeTable('requests', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'owner-requests',
  });

  useRealtimeTable('invoices', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'owner-invoices',
  });

  useRealtimeTable('products', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 400,
    channelName: 'owner-products',
  });

  useRealtimeTable('inventory_logs', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 400,
    channelName: 'owner-inventory-logs',
  });

  useRealtimeTable('delivery_logs', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'owner-delivery-logs',
  });

  useRealtimeTable('activity_logs', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'owner-activity-logs',
  });

  useRealtimeTable('issues', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'owner-issues',
  });

  useRealtimeTable('monthly_closing', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'owner-monthly-closing',
  });

  if (loading || (fetching && !dashboard)) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-56 rounded-lg bg-gray-100" />
            <div className="h-4 w-80 rounded bg-white border-gray-200 shadow-sm" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-gray-100" />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-3">
              <div className="h-3 w-28 rounded bg-gray-100" />
              <div className="h-8 w-24 rounded bg-gray-100" />
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-3">
              <div className="h-5 w-40 rounded bg-gray-100" />
              {Array.from({ length: 5 }).map((__, inner) => (
                <div key={inner} className="h-4 rounded bg-gray-100" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartBlocks = [
    { label: 'Revenue per Month', data: dashboard.revenue.monthlyRevenue },
    { label: 'Orders per Month', data: dashboard.orders.monthlyOrders },
    { label: 'Deliveries per Month', data: dashboard.delivery.deliveriesPerMonth.map((item) => ({ month: item.month, value: item.deliveries })) },
    { label: 'Stock Movement per Month', data: dashboard.inventory.movementByMonth.map((item) => ({ month: item.month, value: item.net })) },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Owner Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Executive-level company visibility across revenue, operations, and fulfillment.</p>
        </div>
        <Link
          href="/dashboard/owner/reports"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors"
        >
          View Reports
        </Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue This Month', value: `Rp${dashboard.stats.totalRevenueThisMonth.toLocaleString('id-ID')}`, color: 'text-emerald-400' },
          { label: 'Total Orders This Month', value: dashboard.stats.totalOrdersThisMonth, color: 'text-gray-900' },
          { label: 'Unpaid Invoices', value: dashboard.stats.unpaidInvoices, color: 'text-red-400' },
          { label: 'Stock Value', value: `Rp${dashboard.stats.stockValue.toLocaleString('id-ID')}`, color: 'text-amber-300' },
          { label: 'Orders In Progress', value: dashboard.stats.ordersInProgress, color: 'text-yellow-400' },
          { label: 'Deliveries In Progress', value: dashboard.stats.deliveriesInProgress, color: 'text-cyan-400' },
          { label: 'Open Issues', value: dashboard.openIssues, color: 'text-rose-400' },
          { label: 'Paid Revenue This Month', value: `Rp${dashboard.stats.paidRevenueThisMonth.toLocaleString('id-ID')}`, color: 'text-green-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="grid xl:grid-cols-2 gap-5">
        {chartBlocks.map((chart) => (
          <div key={chart.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{chart.label}</h2>
            <div className="space-y-3">
              {chart.data.length === 0 ? (
                <p className="text-sm text-gray-500">No data available.</p>
              ) : (
                chart.data.map((point) => (
                  <div key={point.month} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{point.month}</span>
                    <span className="text-gray-900 font-medium">{point.value.toLocaleString('id-ID')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h2>
          <div className="space-y-3">
            {dashboard.topCustomers.map((customer) => (
              <div key={customer.userId} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-900">{customer.userEmail}</p>
                  <p className="text-xs text-gray-500">{customer.invoicesCount} invoice(s)</p>
                </div>
                <p className="text-sm font-semibold text-emerald-400">
                  Rp{customer.totalSpending.toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          <div className="space-y-3">
            {dashboard.topProducts.map((product) => (
              <div key={product.productId} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-900">{product.productName}</span>
                <span className="text-sm font-semibold text-indigo-400">{product.qtySold} units</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Best Technicians</h2>
          <div className="space-y-3">
            {dashboard.employeePerformance.map((employee) => (
              <div key={employee.employeeId} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-900">{employee.employeeName}</p>
                  <p className="text-xs text-gray-500">{employee.role}</p>
                </div>
                <span className="text-sm font-semibold text-cyan-400">
                  {employee.deliveriesCompleted} deliveries
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid xl:grid-cols-[1.1fr_1fr] gap-5">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity Logs</h2>
          <div className="space-y-3">
            {dashboard.recentActivity.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{log.entity_type} • {log.entity_id || 'system'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {dashboard.recentOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{order.user_email || order.user_id}</p>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{new Date(order.created_at).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
