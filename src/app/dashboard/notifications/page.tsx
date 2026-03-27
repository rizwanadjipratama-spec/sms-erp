'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/types';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [limit, setLimit] = useState(25);

  const refresh = useCallback(async () => {
    if (!profile?.id) return;
    setFetching(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    setNotifications((data || []) as Notification[]);
    setFetching(false);
  }, [limit, profile]);

  useEffect(() => {
    if (!profile?.id) return;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timer);
  }, [profile?.id, refresh]);

  useRealtimeTable('notifications', profile?.id ? `user_id=eq.${profile.id}` : undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 200,
    channelName: profile?.id ? `notifications-${profile.id}` : undefined,
  });

  useRealtimeTable('issues', undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `notifications-issues-${profile.id}` : undefined,
  });

  useRealtimeTable('invoices', undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `notifications-invoices-${profile.id}` : undefined,
  });

  useRealtimeTable('requests', undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `notifications-requests-${profile.id}` : undefined,
  });

  const markAllRead = async () => {
    if (!profile?.id) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    await refresh();
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const typeIcon: Record<string, string> = {
    info: 'i',
    success: 'OK',
    warning: '!',
    error: 'X',
  };
  const unread = notifications.filter((notification) => !notification.read).length;

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unread > 0 && <p className="text-gray-500 text-sm mt-1">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-12 text-center">
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.read && markRead(notification.id)}
              className={`bg-white border-gray-200 shadow-sm border rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${
                notification.read ? 'border-gray-200 opacity-60' : 'border-indigo-500/40 hover:border-indigo-500/60'
              }`}
            >
              <span className="text-xs mt-1 text-indigo-300">{typeIcon[notification.type] || 'i'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{notification.message}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(notification.created_at).toLocaleString('id-ID')}
                </p>
              </div>
              {!notification.read && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" />}
            </div>
          ))}
          {notifications.length >= limit && (
            <button
              onClick={() => setLimit((prev) => prev + 25)}
              className="w-full mt-3 px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
