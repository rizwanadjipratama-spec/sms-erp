'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { notificationService } from '@/lib/services';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard } from '@/components/ui';
import { formatRelative } from '@/lib/format-utils';
import type { Notification, NotificationType } from '@/types/types';

const TYPE_STYLES: Record<NotificationType, { icon: string; accent: string }> = {
  info: { icon: 'i', accent: 'bg-blue-500' },
  success: { icon: '\u2713', accent: 'bg-emerald-500' },
  warning: { icon: '!', accent: 'bg-amber-500' },
  error: { icon: '\u2717', accent: 'bg-red-500' },
};

const PAGE_SIZE = 25;

export default function NotificationsPage() {
  const { profile, loading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const result = await notificationService.getForUser(profile.id, {
        page,
        pageSize: PAGE_SIZE,
      });
      setNotifications(result.data);
      setTotalCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setFetching(false);
    }
  }, [profile?.id, page]);

  useEffect(() => {
    if (!profile?.id) return;
    setFetching(true);
    fetchNotifications();
  }, [fetchNotifications, profile?.id]);

  // Realtime: refresh when new notifications arrive
  useRealtimeTable(
    'notifications',
    profile?.id ? `user_id=eq.${profile.id}` : undefined,
    fetchNotifications,
    { enabled: Boolean(profile?.id), debounceMs: 300 }
  );

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!profile?.id) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
      );
      try {
        await notificationService.markRead(id, profile.id);
      } catch {
        // Revert on failure
        await fetchNotifications();
      }
    },
    [profile?.id, fetchNotifications]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!profile?.id) return;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: n.read_at ?? new Date().toISOString() }))
    );
    try {
      await notificationService.markAllRead(profile.id);
    } catch {
      await fetchNotifications();
    }
  }, [profile?.id, fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  // Accumulate across pages
  useEffect(() => {
    if (page === 1) return;
    let cancelled = false;

    const loadMore = async () => {
      if (!profile?.id) return;
      try {
        const result = await notificationService.getForUser(profile.id, {
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newItems = result.data.filter((n) => !existingIds.has(n.id));
            return [...prev, ...newItems];
          });
          setTotalCount(result.count);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load more notifications');
        }
      }
    };

    loadMore();
    return () => {
      cancelled = true;
    };
  }, [page, profile?.id]);

  const hasMore = useMemo(() => {
    return notifications.length < totalCount;
  }, [notifications.length, totalCount]);

  if (loading || (fetching && page === 1)) {
    return <DashboardSkeleton />;
  }

  if (error && notifications.length === 0) {
    return <ErrorState message={error} onRetry={fetchNotifications} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total" value={totalCount} color="blue" />
        <StatCard label="Unread" value={unreadCount} color={unreadCount > 0 ? 'red' : 'gray'} />
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="You'll see updates about your orders and system events here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const style = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info;

            return (
              <div
                key={notification.id}
                onClick={() => !notification.read && handleMarkRead(notification.id)}
                role={notification.read ? undefined : 'button'}
                tabIndex={notification.read ? undefined : 0}
                onKeyDown={(e) => {
                  if (!notification.read && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleMarkRead(notification.id);
                  }
                }}
                className={`flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition-all dark:bg-gray-900 ${
                  notification.read
                    ? 'border-gray-100 opacity-60 dark:border-gray-800'
                    : 'cursor-pointer border-blue-200 hover:border-blue-300 dark:border-blue-800 dark:hover:border-blue-700'
                }`}
              >
                {/* Type indicator */}
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${style.accent}`}
                >
                  {style.icon}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {notification.title && (
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {notification.title}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {notification.message}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {formatRelative(notification.created_at)}
                  </p>
                </div>

                {/* Unread dot */}
                {!notification.read && (
                  <div className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={fetching}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {fetching ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
