'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { notificationService } from '@/lib/services';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard } from '@/components/ui';
import { formatRelative } from '@/lib/format-utils';
import type { Notification, NotificationType } from '@/types/types';

const TYPE_STYLES: Record<NotificationType, { icon: string; accent: string }> = {
  info: { icon: 'i', accent: 'bg-[var(--apple-blue)]' },
  success: { icon: '\u2713', accent: 'bg-[var(--apple-success)]' },
  warning: { icon: '!', accent: 'bg-[var(--apple-warning)]' },
  error: { icon: '\u2717', accent: 'bg-[var(--apple-danger)]' },
};

const PAGE_SIZE = 25;

type FilterTab = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const { profile, loading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<FilterTab>('all');

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

  // Realtime: refresh when notifications change
  useRealtimeTable(
    'notifications',
    profile?.id ? `user_id=eq.${profile.id}` : undefined,
    fetchNotifications,
    { enabled: Boolean(profile?.id), debounceMs: 300 },
  );

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'unread': return notifications.filter(n => !n.read);
      case 'read': return notifications.filter(n => n.read);
      default: return notifications;
    }
  }, [notifications, filter]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!profile?.id) return;
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n)));
      try {
        await notificationService.markRead(id, profile.id);
      } catch {
        await fetchNotifications();
      }
    },
    [profile?.id, fetchNotifications],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!profile?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true, read_at: n.read_at ?? new Date().toISOString() })));
    try {
      await notificationService.markAllRead(profile.id);
    } catch {
      await fetchNotifications();
    }
  }, [profile?.id, fetchNotifications]);

  const handleLoadMore = useCallback(() => setPage(prev => prev + 1), []);

  // Accumulate across pages
  useEffect(() => {
    if (page === 1) return;
    let cancelled = false;
    const loadMore = async () => {
      if (!profile?.id) return;
      try {
        const result = await notificationService.getForUser(profile.id, { page, pageSize: PAGE_SIZE });
        if (!cancelled) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newItems = result.data.filter(n => !existingIds.has(n.id));
            return [...prev, ...newItems];
          });
          setTotalCount(result.count);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load more');
      }
    };
    loadMore();
    return () => { cancelled = true; };
  }, [page, profile?.id]);

  const hasMore = useMemo(() => notifications.length < totalCount, [notifications.length, totalCount]);

  if (loading || (fetching && page === 1)) {
    return <DashboardSkeleton />;
  }

  if (error && notifications.length === 0) {
    return <ErrorState message={error} onRetry={fetchNotifications} />;
  }

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'read', label: 'Read', count: totalCount - unreadCount },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-xl px-4 py-2 text-sm font-bold text-[var(--apple-blue)] transition-all hover:bg-[var(--apple-blue)]/5 active:scale-95"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total" value={totalCount} color="blue" />
        <StatCard label="Unread" value={unreadCount} color={unreadCount > 0 ? 'red' : 'green'} />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--apple-gray-bg)] rounded-xl border border-[var(--apple-border)]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
              filter === tab.key
                ? 'bg-white text-[var(--apple-text-primary)] shadow-sm'
                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'All caught up!' : 'No notifications'}
          description={filter === 'unread' ? 'You have no unread notifications.' : 'Notifications about your orders and system events will appear here.'}
        />
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map(notification => {
            const style = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info;

            return (
              <div
                key={notification.id}
                onClick={() => !notification.read && handleMarkRead(notification.id)}
                role={notification.read ? undefined : 'button'}
                tabIndex={notification.read ? undefined : 0}
                onKeyDown={e => {
                  if (!notification.read && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleMarkRead(notification.id);
                  }
                }}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm transition-all ${
                  notification.read
                    ? 'border-[var(--apple-border)] bg-[var(--apple-gray-bg)] opacity-60'
                    : 'cursor-pointer border-[var(--apple-blue)]/20 bg-white hover:border-[var(--apple-blue)]/40 hover:shadow-md'
                }`}
              >
                {/* Type indicator */}
                <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${style.accent}`}>
                  {style.icon}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {notification.title && (
                    <p className="text-sm font-bold text-[var(--apple-text-primary)]">
                      {notification.title}
                    </p>
                  )}
                  <p className="text-sm text-[var(--apple-text-secondary)]">
                    {notification.message}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--apple-text-tertiary)]">
                    {formatRelative(notification.created_at)}
                  </p>
                </div>

                {/* Unread dot */}
                {!notification.read && (
                  <div className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[var(--apple-blue)]" />
                )}
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && filter === 'all' && (
            <button
              onClick={handleLoadMore}
              disabled={fetching}
              className="mt-3 w-full rounded-xl border border-[var(--apple-border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--apple-text-secondary)] transition-all hover:bg-[var(--apple-gray-bg)] active:scale-[0.98] disabled:opacity-50"
            >
              {fetching ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
