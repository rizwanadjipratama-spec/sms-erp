'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/lib/services/notification-service';
import { useRouter } from 'next/navigation';

export function NotificationBell() {
  const { profile } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!profile?.id) return;
    const c = await notificationService.getUnreadCount(profile.id);
    setCount(c);
  }, [profile?.id]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Real-time subscription
  useEffect(() => {
    if (!profile?.id) return;
    const unsub = notificationService.subscribeToNotifications(profile.id, () => {
      setCount(prev => prev + 1);
    });
    return unsub;
  }, [profile?.id]);

  return (
    <button
      onClick={() => router.push('/dashboard/notifications')}
      className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
