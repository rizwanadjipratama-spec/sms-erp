'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { analyticsService, authService } from '@/lib/services';
import { profilesDb } from '@/lib/db';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format-utils';
import { DashboardSkeleton, StatCard, EmptyState, ErrorState } from '@/components/ui';
import type { CmsNews, CmsEvent, Profile } from '@/types/types';

type CompanyData = Awaited<ReturnType<typeof analyticsService.getCompanyDashboard>>;

// ── Mini bar chart for revenue ──────────────────────────────────────────
function RevenueChart({ data }: { data: { month: string; total_revenue: number }[] }) {
  const reversed = [...data].reverse().slice(-6);
  const maxVal = Math.max(...reversed.map(d => d.total_revenue), 1);

  return (
    <div className="flex items-end gap-2 h-32">
      {reversed.map((item) => {
        const height = Math.max((item.total_revenue / maxVal) * 100, 4);
        const label = item.month?.slice(5) || '??'; // MM from YYYY-MM
        return (
          <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[var(--apple-blue)] rounded-t-md transition-all duration-500 min-w-[24px]"
              style={{ height: `${height}%` }}
              title={formatCurrency(item.total_revenue)}
            />
            <span className="text-[10px] font-bold text-[var(--apple-text-secondary)]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CompanyDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<CompanyData | null>(null);
  const [activeUsers, setActiveUsers] = useState<Profile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/company')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Fetch
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const [data, online] = await Promise.all([
        analyticsService.getCompanyDashboard(),
        profilesDb.getActiveUsers(5),
      ]);
      setDashboard(data);
      setActiveUsers(online);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // Realtime for key tables
  useRealtimeTable('requests', undefined, refresh, { enabled: Boolean(profile), debounceMs: 500 });
  useRealtimeTable('invoices', undefined, refresh, { enabled: Boolean(profile), debounceMs: 500 });

  // Loading
  if (loading || (fetching && !dashboard)) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  if (!dashboard) return null;

  const { stats, monthlyRevenue, announcement, employeeOfMonth, news, events, ordersByStatus } = dashboard;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--apple-text-primary)] tracking-tight">
            Company Dashboard
          </h1>
          <p className="text-[var(--apple-text-secondary)] text-sm">
            PT Sarana Megamedilab Sejahtera — Overview
          </p>
        </div>
        <Link
          href="/dashboard/company/performance"
          className="bg-[var(--apple-blue)] hover:bg-[var(--apple-blue-hover)] text-white text-sm font-bold px-5 py-2 rounded-xl transition-all active:scale-95 shadow-sm text-center"
        >
          Employee Performance
        </Link>
      </div>

      {/* Announcement Banner */}
      {announcement && announcement.text && (
        <div className="bg-[var(--apple-blue)]/5 border border-[var(--apple-blue)]/15 rounded-xl p-4 flex items-center gap-3">
          <div className="text-[var(--apple-blue)] text-lg shrink-0">📢</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--apple-text-primary)]">{announcement.text}</p>
          </div>
          {announcement.link && (
            <a href={announcement.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-[var(--apple-blue)] hover:underline shrink-0">
              Read more
            </a>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Month Revenue" value={formatCurrency(stats.monthRevenue)} color="green" />
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} color="blue" />
        <StatCard label="Total Orders" value={formatNumber(stats.totalOrders)} color="purple" />
        <StatCard label="Total Deliveries" value={formatNumber(stats.totalDeliveries)} color="yellow" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Staff Members" value={formatNumber(stats.totalStaff)} color="blue" />
        <StatCard label="Clients" value={formatNumber(stats.totalClients)} color="green" />
        <StatCard label="Paid Invoices" value={formatNumber(stats.paidInvoices)} color="green" />
        <StatCard label="Unpaid Invoices" value={formatNumber(stats.unpaidInvoices)} color="red" />
      </div>

      {/* Active Users */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">
            Active Now
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-green-50 text-green-600 border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {activeUsers.length} online
            </span>
          </h2>
        </div>
        {activeUsers.length === 0 ? (
          <p className="text-sm text-[var(--apple-text-tertiary)]">No users active in the last 5 minutes.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {activeUsers.map(user => (
              <div key={user.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[var(--apple-blue)]/10 flex items-center justify-center text-xs font-black text-[var(--apple-blue)]">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--apple-text-primary)] leading-tight">{user.name || user.email}</p>
                  <p className="text-[10px] text-[var(--apple-text-tertiary)] uppercase font-bold">{user.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Monthly Revenue</h2>
          {monthlyRevenue.length > 0 ? (
            <RevenueChart data={monthlyRevenue} />
          ) : (
            <EmptyState title="No revenue data" description="Revenue data will appear once invoices are paid." />
          )}
        </div>

        {/* Employee of the Month */}
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Employee of the Month</h2>
          {employeeOfMonth ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--apple-blue)] to-purple-500 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                {employeeOfMonth.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-bold text-[var(--apple-text-primary)] text-lg">{employeeOfMonth.name || 'Unknown'}</p>
                <p className="text-sm text-[var(--apple-text-secondary)]">{employeeOfMonth.email}</p>
                <span className="inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-200 uppercase">
                  {employeeOfMonth.role}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState title="Not set" description="Admin can set Employee of the Month in CMS." />
          )}
        </div>
      </div>

      {/* Order Pipeline */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Order Pipeline</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {[
            { key: 'submitted', label: 'Submitted', color: 'bg-gray-100 text-gray-700' },
            { key: 'priced', label: 'Priced', color: 'bg-blue-50 text-blue-700' },
            { key: 'approved', label: 'Approved', color: 'bg-indigo-50 text-indigo-700' },
            { key: 'invoice_ready', label: 'Invoice', color: 'bg-purple-50 text-purple-700' },
            { key: 'preparing', label: 'Preparing', color: 'bg-yellow-50 text-yellow-700' },
            { key: 'ready', label: 'Ready', color: 'bg-orange-50 text-orange-700' },
            { key: 'on_delivery', label: 'Delivery', color: 'bg-cyan-50 text-cyan-700' },
          ].map(s => (
            <div key={s.key} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-2xl font-black">{ordersByStatus[s.key] ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* News & Events Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* News */}
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Latest News</h2>
          {news.length === 0 ? (
            <EmptyState title="No news" description="Company news will appear here." />
          ) : (
            <div className="space-y-3">
              {news.map((item: CmsNews) => (
                <div key={item.id} className="p-3 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
                  <p className="font-bold text-sm text-[var(--apple-text-primary)] line-clamp-1">{item.title}</p>
                  <p className="text-xs text-[var(--apple-text-secondary)] mt-1 line-clamp-2">{item.content}</p>
                  {item.published_at && (
                    <p className="text-[10px] text-[var(--apple-text-tertiary)] mt-2">
                      {new Date(item.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Upcoming Events</h2>
          {events.length === 0 ? (
            <EmptyState title="No events" description="Company events will appear here." />
          ) : (
            <div className="space-y-3">
              {events.map((item: CmsEvent) => (
                <div key={item.id} className="p-3 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] flex items-start gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-[var(--apple-blue)]/10 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-[var(--apple-blue)] uppercase">
                      {item.event_date ? new Date(item.event_date).toLocaleDateString('id-ID', { month: 'short' }) : '—'}
                    </span>
                    <span className="text-lg font-black text-[var(--apple-blue)] leading-none">
                      {item.event_date ? new Date(item.event_date).getDate() : '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--apple-text-primary)] line-clamp-1">{item.title}</p>
                    {item.location && (
                      <p className="text-xs text-[var(--apple-text-secondary)] mt-0.5">{item.location}</p>
                    )}
                    {item.description && (
                      <p className="text-xs text-[var(--apple-text-tertiary)] mt-1 line-clamp-1">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
