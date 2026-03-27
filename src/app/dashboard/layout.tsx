'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute, type AppRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { NAV_ITEMS } from '@/lib/navigation';


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      router.push('/login');
    }
  }, [loading, profile, router]);

  const role = profile?.role || 'user';
  const visibleNav = NAV_ITEMS.filter((item) => canAccessRoute(role, item.href));


  useEffect(() => {
    if (loading || !profile) return;
    if (pathname === '/dashboard') return;

    const hasDirectAccess = canAccessRoute(profile.role, pathname);
    const hasNestedAccess = NAV_ITEMS.some(
      (item) => pathname.startsWith(item.href + '/') && canAccessRoute(profile.role, item.href)
    );

    if (!hasDirectAccess && !hasNestedAccess) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, pathname, profile, router]);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('notifications-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-gray-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-apple-text-secondary text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex min-h-screen bg-apple-gray-bg text-apple-text-primary antialiased">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[35] lg:hidden transition-opacity duration-300" 
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        unreadCount={unreadCount}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-apple-gray-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 rounded-apple hover:bg-apple-gray-bg text-apple-text-secondary transition-all active:scale-95" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold tracking-tight text-apple-text-primary hidden sm:block">
              {visibleNav.find(item => pathname === item.href || pathname.startsWith(item.href + '/'))?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard/notifications" 
              className="relative p-2 rounded-apple hover:bg-apple-gray-bg text-apple-text-secondary transition-all active:scale-95 group"
            >
              <svg className="w-5 h-5 group-hover:text-apple-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11 6 0v-1m-6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-apple-danger rounded-full ring-2 ring-white" />
              )}
            </Link>

            <div className="w-8 h-8 bg-apple-blue/10 text-apple-blue rounded-full flex items-center justify-center text-xs font-bold uppercase ring-1 ring-apple-blue/20">
              {(profile.name || profile.email || 'U')[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-white p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <button
              onClick={() => router.back()}
              className="mb-6 px-4 py-1.5 rounded-apple bg-apple-gray-bg hover:bg-apple-gray-border text-apple-text-secondary text-xs font-semibold transition-all active:scale-95 flex items-center gap-2 group shadow-sm border border-apple-gray-border/50"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform duration-300">←</span> Back
            </button>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

