'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { analyticsService, workflowEngine, authService } from '@/lib/services';
import { profilesDb, issuesDb, activityLogsDb, requestsDb } from '@/lib/db';
import { formatCurrency, formatRelative } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard, StatusBadge } from '@/components/ui';
import type { Profile, Issue, ActivityLog, DbRequest, UserRole, IssueStatus } from '@/types/types';

const ALL_ROLES: UserRole[] = ['client', 'marketing', 'boss', 'finance', 'warehouse', 'technician', 'admin', 'owner', 'tax'];
const PAGE_SIZE = 25;

type TabKey = 'issues' | 'activity';

import { useBranch } from '@/hooks/useBranch';

export default function AdminDashboard() {
  const { profile, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('issues');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [requestMap, setRequestMap] = useState<Record<string, DbRequest>>({});
  
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/admin-panel')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // ---------- Data fetching via DB layer ----------
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);

    try {
      const [adminData, activityData, requestData] = await Promise.all([
        analyticsService.getAdminDashboard(activeBranchId),
        activityLogsDb.getRecent(50),
        requestsDb.getByStatus(['issue', 'resolved'], undefined, activeBranchId),
      ]);

      setIssues(adminData.openIssues);
      setActivityLogs(activityData);

      const reqMap = requestData.data.reduce<Record<string, DbRequest>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
      setRequestMap(reqMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile, activeBranchId]);

  useEffect(() => {
    if (!profile) return;
    void refresh();
  }, [profile, activeBranchId, refresh]);

  // ---------- Realtime subscriptions ----------

  useRealtimeTable('issues', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('activity_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 400,
  });

  // ---------- Handlers ----------
  const handleResolveIssue = useCallback(async (issue: Issue) => {
    if (!profile) return;
    setSaving(issue.id);
    try {
      const request = requestMap[issue.order_id];
      if (!request) throw new Error('Request not found for this issue');

      await issuesDb.update(issue.id, {
        status: 'resolved' as IssueStatus,
        resolved_at: new Date().toISOString(),
      });

      await workflowEngine.transition({
        request,
        actorId: profile.id,
        actorEmail: profile.email,
        actorRole: profile.role,
        nextStatus: 'resolved',
        action: 'resolved',
        message: `Issue resolved for request ${request.id}`,
        type: 'success',
        notifyRoles: ['owner'],
        metadata: { issue_id: issue.id },
      });

      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve issue');
    } finally {
      setSaving(null);
    }
  }, [profile, requestMap, refresh]);

  // ---------- Computed ----------
  const statCards = useMemo(() => [
    { label: 'Open Issues', value: issues.length, color: 'red' as const },
    { label: 'Recent Activity', value: activityLogs.length, color: 'purple' as const },
  ], [issues.length, activityLogs.length]);

  const TABS: { key: TabKey; label: string; count?: number }[] = useMemo(() => [
    { key: 'issues', label: 'Issues', count: issues.length },
    { key: 'activity', label: 'Activity', count: activityLogs.length },
  ], [issues.length, activityLogs.length]);

  // ---------- Loading ----------
  if (loading || (fetching && !issues.length)) {
    return (
      <div className="mx-auto max-w-6xl">
        <DashboardSkeleton />
      </div>
    );
  }

  // ---------- Error ----------
  if (error && !issues.length) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users and resolve operational issues.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/admin/automation"
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 active:scale-95"
          >
            Automation
          </Link>
          <Link
            href="/dashboard/admin/system-health"
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 active:scale-95"
          >
            System Health
          </Link>
          <Link
            href="/dashboard/admin/backups"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 active:scale-95"
          >
            Backups
          </Link>
        </div>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      {/* ---------- Tabs ---------- */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs text-gray-400">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ====== TAB: Issues ====== */}
      {tab === 'issues' && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            Open Issues ({issues.length})
          </h2>

          {issues.length === 0 ? (
            <EmptyState
              title="No unresolved issues"
              description="All issues have been resolved."
            />
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => {
                const request = requestMap[issue.order_id];
                return (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">
                            Order {issue.order_id.slice(0, 8)}
                          </p>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            issue.status === 'open'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {issue.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Reported {formatRelative(issue.created_at)}
                        </p>
                        {request && (
                          <p className="mt-1 text-xs text-gray-500">
                            Client: {request.user_email || request.user_id}
                          </p>
                        )}
                        <p className="mt-3 text-sm text-gray-600">{issue.description}</p>
                      </div>
                      <button
                        onClick={() => handleResolveIssue(issue)}
                        disabled={saving === issue.id}
                        className="flex-shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {saving === issue.id ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ====== TAB: Activity ====== */}
      {tab === 'activity' && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            Recent Activity ({activityLogs.length})
          </h2>

          {activityLogs.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Activity logs will appear as actions are performed in the system."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Entity</th>
                    <th className="hidden px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">Actor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">When</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{log.action}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="text-xs text-gray-400">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="ml-1 text-xs text-gray-500">
                            {log.entity_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">
                        {log.user_email || log.user_id || 'system'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {formatRelative(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
