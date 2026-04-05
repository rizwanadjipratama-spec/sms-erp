'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { automationService } from '@/lib/automation-service';
import { requireAuthUser } from '@/lib/db';
import type { AutomationEvent, AutomationLog } from '@/types/types';

export default function AutomationDashboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const [runningTask, setRunningTask] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/admin-panel')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
      const [nextEvents, nextLogs] = await Promise.all([
        automationService.getAutomationEvents(),
        automationService.getAutomationLogs(40),
      ]);
      setEvents(nextEvents);
      setLogs(nextLogs);
    } catch (error) {
      console.error('Automation event fetch failed:', error);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('automation_events', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('automation_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  const runTask = async (taskId: string, task: () => Promise<unknown>) => {
    setRunningTask(taskId);
    try {
      await task();
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Automation task failed');
    } finally {
      setRunningTask(null);
    }
  };

  const pendingEvents = useMemo(() => events.filter((event) => event.status === 'pending'), [events]);
  const failedEvents = useMemo(() => events.filter((event) => event.status === 'failed'), [events]);
  const processedEvents = useMemo(() => events.filter((event) => event.status === 'processed'), [events]);

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Console</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor queued automation events and trigger operational checks.</p>
        </div>
        <Link
          href="/dashboard/admin"
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
        >
          Back to Admin
        </Link>
        <Link
          href="/dashboard/admin/automation/settings"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors"
        >
          Automation Settings
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: pendingEvents.length, color: 'text-yellow-400' },
          { label: 'Processed', value: processedEvents.length, color: 'text-green-400' },
          { label: 'Failed', value: failedEvents.length, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          onClick={() => runTask('process', () => automationService.processPendingEvents())}
          disabled={runningTask !== null}
          className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors disabled:opacity-50"
        >
          {runningTask === 'process' ? 'Processing...' : 'Process Events'}
        </button>
        <button
          onClick={() =>
            runTask('stock', async () => {
              const actor = await requireAuthUser();
              await automationService.checkLowStock({
                id: actor.id,
                email: actor.email || profile?.email,
                role: profile?.role || 'admin',
              });
            })
          }
          disabled={runningTask !== null}
          className="px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm transition-colors disabled:opacity-50"
        >
          {runningTask === 'stock' ? 'Running...' : 'Run Low Stock Check'}
        </button>
        <button
          onClick={() =>
            runTask('invoice', async () => {
              const actor = await requireAuthUser();
              await automationService.checkOverdueInvoices({
                id: actor.id,
                email: actor.email || profile?.email,
                role: profile?.role || 'admin',
              });
            })
          }
          disabled={runningTask !== null}
          className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm transition-colors disabled:opacity-50"
        >
          {runningTask === 'invoice' ? 'Running...' : 'Run Invoice Check'}
        </button>
        <button
          onClick={() =>
            runTask('monthly', async () => {
              const actor = await requireAuthUser();
              await automationService.runMonthlyAutomation({
                id: actor.id,
                email: actor.email || profile?.email,
                role: profile?.role || 'admin',
              });
            })
          }
          disabled={runningTask !== null}
          className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm transition-colors disabled:opacity-50"
        >
          {runningTask === 'monthly' ? 'Running...' : 'Run Monthly Automation'}
        </button>
      </div>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Automation Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No automation events recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{event.event_type}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      event.status === 'processed'
                        ? 'bg-green-500/20 text-green-300'
                        : event.status === 'failed'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                    }`}
                  >
                    {event.status.toUpperCase()}
                  </span>
                </div>
                {event.payload && (
                  <pre className="mt-3 text-xs text-gray-500 whitespace-pre-wrap break-words">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
                {event.status === 'failed' && (
                  <button
                    onClick={() => runTask(`retry-${event.id}`, () => automationService.retryEvent(event.id))}
                    disabled={runningTask !== null}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs transition-colors disabled:opacity-50"
                  >
                    Retry Event
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Webhook Logs</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No webhook logs yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.webhook_url}</p>
                    <p className="text-xs text-gray-500 mt-1">Event {log.event_id}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      log.status === 'success'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {log.status.toUpperCase()}
                  </span>
                </div>
                {log.response && (
                  <p className="text-xs text-gray-500 mt-3 break-words">{log.response}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
