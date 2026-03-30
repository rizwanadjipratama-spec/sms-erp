'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/lib/services/notification-service';
import { useRouter } from 'next/navigation';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

export function NotificationBell() {
  const { profile } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const c = await notificationService.getUnreadCount(profile.id);
      setCount(c);
    } catch {
      // Silently fail — non-critical
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Re-fetch count on any notification change (INSERT, UPDATE, DELETE)
  useRealtimeTable(
    'notifications',
    profile?.id ? `user_id=eq.${profile.id}` : undefined,
    fetchCount,
    { enabled: Boolean(profile?.id), debounceMs: 300 },
  );

  return (
    <button
      onClick={() => router.push('/dashboard/notifications')}
      className="relative rounded-xl p-2 text-[var(--apple-text-secondary)] transition-all hover:bg-[var(--apple-gray-bg)] hover:text-[var(--apple-text-primary)]"
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--apple-danger)] px-1 text-[10px] font-bold text-white animate-pulse">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
