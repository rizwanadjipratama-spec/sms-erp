'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { issuesDb, requestsDb, requireAuthUser } from '@/lib/db';
import { workflowEngine } from '@/lib/services';
import { formatDate, formatOrderId, formatRelative } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatusBadge, StatCard, Modal } from '@/components/ui';
import type { Issue, DbRequest } from '@/types/types';

export default function IssuesPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [issues, setIssues] = useState<Issue[]>([]);
  const [orders, setOrders] = useState<DbRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch issues and orders
  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const [issueData, orderData] = await Promise.all([
        issuesDb.getByUser(profile.id),
        requestsDb.getByUser(profile.id),
      ]);
      setIssues(issueData);
      setOrders(orderData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setFetching(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscriptions
  useRealtimeTable(
    'issues',
    profile?.id ? `reported_by=eq.${profile.id}` : undefined,
    fetchData,
    { enabled: Boolean(profile?.id), debounceMs: 300 }
  );

  useRealtimeTable(
    'requests',
    profile?.id ? `user_id=eq.${profile.id}` : undefined,
    fetchData,
    { enabled: Boolean(profile?.id), debounceMs: 300 }
  );

  // Find the target order for issue submission
  const targetOrder = useMemo(() => {
    if (!orderId) return null;
    return orders.find((o) => o.id === orderId) ?? null;
  }, [orderId, orders]);

  // Stats
  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status === 'open').length;
    const inProgress = issues.filter((i) => i.status === 'in_progress').length;
    const resolved = issues.filter((i) => i.status === 'resolved').length;
    return { open, inProgress, resolved, total: issues.length };
  }, [issues]);

  // Submit issue handler
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!orderId || !description.trim() || !profile?.id || !targetOrder) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const user = await requireAuthUser();

        // Create the issue record
        await issuesDb.create({
          order_id: orderId,
          reported_by: profile.id,
          description: description.trim(),
          status: 'open',
        });

        // Transition the order to 'issue' status
        await workflowEngine.transition({
          request: targetOrder,
          actorId: user.id,
          actorEmail: profile.email,
          actorRole: 'client',
          nextStatus: 'issue',
          action: 'issue',
          message: `Issue reported for order ${formatOrderId(orderId)}`,
          type: 'warning',
          notifyRoles: ['admin', 'owner'],
          metadata: { description: description.trim() },
        });

        setDescription('');
        await fetchData();
        router.push('/dashboard/client');
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to submit issue');
      } finally {
        setSubmitting(false);
      }
    },
    [orderId, description, profile?.id, profile?.email, targetOrder, fetchData, router]
  );

  if (loading || fetching) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/client"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="Back to dashboard"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {orderId ? 'Report an Issue' : 'My Issues'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {orderId
              ? 'Tell the team what happened with this delivery.'
              : 'View and track reported issues on your orders.'}
          </p>
        </div>
      </div>

      {/* Stats */}
      {issues.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Open" value={stats.open} color="red" />
          <StatCard label="In Progress" value={stats.inProgress} color="yellow" />
          <StatCard label="Resolved" value={stats.resolved} color="green" />
        </div>
      )}

      {/* Issue form (when orderId is provided) */}
      {orderId && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            Issue Details
          </h2>

          {!targetOrder ? (
            <ErrorState
              title="Order not found"
              message={`Order ${formatOrderId(orderId)} was not found or does not belong to you.`}
            />
          ) : targetOrder.status !== 'delivered' ? (
            <ErrorState
              title="Cannot report issue"
              message={`Order ${formatOrderId(orderId)} is in "${targetOrder.status}" status. Issues can only be reported for delivered orders.`}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                Order: <span className="font-mono font-semibold">{formatOrderId(orderId)}</span>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                required
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                placeholder="Describe the issue in detail..."
              />

              {submitError && (
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !description.trim()}
                className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Issue'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Issues list */}
      <section>
        {!orderId && <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">My Issues</h2>}

        {issues.length === 0 ? (
          <EmptyState
            title="No issues reported"
            description="If you have a problem with a delivery, you can report an issue from your order details."
          />
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      issue.status === 'open'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : issue.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {issue.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {formatRelative(issue.created_at)}
                  </span>
                </div>

                <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">
                  Order: <span className="font-mono">{formatOrderId(issue.order_id)}</span>
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{issue.description}</p>

                {issue.resolution && (
                  <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    <span className="font-medium">Resolution:</span> {issue.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
