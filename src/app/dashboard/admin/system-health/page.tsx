'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { authService } from '@/lib/services';
import { canAccessRoute } from '@/lib/permissions';
import { getSystemHealthSnapshot, type SystemHealthSnapshot } from '@/lib/system-health-service';
import { formatCurrency } from '@/lib/format-utils';

export default function SystemHealthPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [health, setHealth] = useState<SystemHealthSnapshot | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/admin')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      setHealth(await getSystemHealthSnapshot());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load system health');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    void refresh();
  }, [profile, refresh]);

  useRealtimeTable('automation_events', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('invoices', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('products', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('issues', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('monthly_closing', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('system_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('activity_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('delivery_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('inventory_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  if (loading || fetching || !health) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-56 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-4 w-72 rounded bg-white border-gray-200 shadow-sm animate-pulse" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-gray-100 animate-pulse" />
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 18 }).map((_, index) => (
            <div key={index} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="h-8 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 text-sm mt-1">Operational health checks for database, automation, finance, inventory, and monthly closing.</p>
        </div>
        <Link
          href="/dashboard/admin"
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
        >
          Back to Admin
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Database',
            value: health.database.healthy ? 'Connected' : 'Unavailable',
            tone: health.database.healthy ? 'text-emerald-400' : 'text-red-400',
          },
          {
            label: 'Pending Automation',
            value: health.automation.pending,
            tone: 'text-yellow-400',
          },
          {
            label: 'Failed Automation',
            value: health.automation.failed,
            tone: health.automation.failed > 0 ? 'text-red-400' : 'text-emerald-400',
          },
          {
            label: 'Unpaid Invoices',
            value: health.finance.unpaidInvoices,
            tone: 'text-orange-400',
          },
          {
            label: 'Low Stock Items',
            value: health.inventory.lowStockItems,
            tone: health.inventory.lowStockItems > 0 ? 'text-amber-300' : 'text-emerald-400',
          },
          {
            label: 'Open Issues',
            value: health.issues.openIssues,
            tone: health.issues.openIssues > 0 ? 'text-rose-400' : 'text-emerald-400',
          },
          {
            label: 'Uptime Indicator',
            value: health.uptime.status.toUpperCase(),
            tone: health.uptime.status === 'online' ? 'text-emerald-400' : 'text-red-400',
          },
          {
            label: 'Last Checked',
            value: new Date(health.uptime.checkedAt).toLocaleString('id-ID'),
            tone: 'text-gray-700',
          },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{card.label}</p>
            <p className={`text-xl font-semibold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: 'Total Requests', value: health.metrics.totalRequests, tone: 'text-cyan-300' },
          { label: 'Total Invoices', value: health.metrics.totalInvoices, tone: 'text-blue-300' },
          { label: 'Total Deliveries', value: health.metrics.totalDeliveries, tone: 'text-violet-300' },
          {
            label: 'Total Revenue',
            value: formatCurrency(health.metrics.totalRevenue),
            tone: 'text-emerald-300',
          },
          {
            label: 'Automation Processed',
            value: health.metrics.automationProcessed,
            tone: 'text-teal-300',
          },
          {
            label: 'Automation Failed',
            value: health.metrics.automationFailed,
            tone: health.metrics.automationFailed > 0 ? 'text-red-300' : 'text-emerald-300',
          },
          { label: 'Emails Sent', value: health.metrics.emailsSent, tone: 'text-sky-300' },
          { label: 'PDFs Generated', value: health.metrics.pdfsGenerated, tone: 'text-fuchsia-300' },
          {
            label: 'Avg Delivery Hours',
            value: health.metrics.averageDeliveryHours.toFixed(2),
            tone: 'text-amber-300',
          },
          {
            label: 'Stock Value',
            value: formatCurrency(health.metrics.stockValue),
            tone: 'text-lime-300',
          },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{card.label}</p>
            <p className={`text-xl font-semibold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Last Monthly Closing</h2>
        {!health.monthlyClosing.lastClosing ? (
          <p className="text-sm text-gray-500">No monthly closing snapshot recorded yet.</p>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
            <p className="text-sm font-medium text-gray-900">
              {String(health.monthlyClosing.lastClosing.month).padStart(2, '0')}/{health.monthlyClosing.lastClosing.year}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Revenue {formatCurrency(health.monthlyClosing.lastClosing.total_revenue)} • Orders {health.monthlyClosing.lastClosing.orders_count}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Paid {health.monthlyClosing.lastClosing.paid_invoices} • Unpaid {health.monthlyClosing.lastClosing.unpaid_invoices}
            </p>
          </div>
        )}
      </section>

      <section className="grid xl:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent System Logs</h2>
          <div className="space-y-3">
            {health.logs.recentSystemLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No system logs recorded yet.</p>
            ) : (
              health.logs.recentSystemLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{log.service} / {log.action}</p>
                    <span
                      className={`text-[11px] uppercase tracking-wide ${
                        log.level === 'error'
                          ? 'text-red-300'
                          : log.level === 'warning'
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                      }`}
                    >
                      {log.level}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{log.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(log.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Lifecycle Timeline</h2>
          <div className="space-y-3">
            {health.timelines.request.length === 0 ? (
              <p className="text-sm text-gray-500">No request activity recorded yet.</p>
            ) : (
              health.timelines.request.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-3">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {item.actor || 'system'} • {new Date(item.timestamp).toLocaleString('id-ID')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid xl:grid-cols-3 gap-6">
        {[
          { title: 'Invoice Timeline', items: health.timelines.invoice },
          { title: 'Inventory Movement Timeline', items: health.timelines.inventory },
          { title: 'Delivery Timeline', items: health.timelines.delivery },
        ].map((section) => (
          <div key={section.title} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
            <div className="space-y-3">
              {section.items.length === 0 ? (
                <p className="text-sm text-gray-500">No events recorded yet.</p>
              ) : (
                section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-3">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {item.actor || 'system'} • {new Date(item.timestamp).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
