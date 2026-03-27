'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute, type AppRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS: Array<{ href: AppRoute; label: string; icon: string }> = [
  { href: '/dashboard', label: 'Dashboard', icon: 'Home' },
  { href: '/dashboard/client', label: 'My Orders', icon: 'Orders' },
  { href: '/request', label: 'New Request', icon: 'New' },
  { href: '/dashboard/marketing', label: 'Marketing', icon: 'Marketing' },
  { href: '/dashboard/marketing/prices', label: 'Price List', icon: 'Prices' },
  { href: '/dashboard/boss', label: 'Approvals', icon: 'Boss' },
  { href: '/dashboard/finance', label: 'Finance', icon: 'Finance' },
  { href: '/dashboard/warehouse', label: 'Warehouse', icon: 'Warehouse' },
  { href: '/dashboard/technician', label: 'Delivery', icon: 'Delivery' },
  { href: '/dashboard/tax', label: 'Tax Reports', icon: 'Tax' },
  { href: '/dashboard/owner', label: 'Analytics', icon: 'Owner' },
  { href: '/dashboard/admin', label: 'Admin Panel', icon: 'Admin' },
];

const ROLE_COLORS: Record<string, string> = {
  client: 'bg-blue-500',
  marketing: 'bg-purple-500',
  boss: 'bg-amber-500',
  finance: 'bg-green-500',
  warehouse: 'bg-orange-500',
  technician: 'bg-cyan-500',
  admin: 'bg-red-500',
  owner: 'bg-indigo-500',
  tax: 'bg-teal-500',
  user: 'bg-gray-500',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      router.push('/login');
    }
  }, [loading, profile, router]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const role = profile.role || 'user';
  const visibleNav = NAV_ITEMS.filter((item) => canAccessRoute(role, item.href));
  const roleColor = ROLE_COLORS[role] || 'bg-gray-500';

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[35] lg:hidden" 
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-72 sm:w-64 bg-white border-r border-gray-200 z-40 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto lg:w-64 lg:h-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 sm:p-5 border-b border-gray-200 flex-shrink-0">
          <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="w-10 h-10 sm:w-8 sm:h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-base font-bold sm:text-sm shrink-0">S</div>
            <span className="text-lg font-bold text-gray-900 sm:text-base sm:font-semibold whitespace-nowrap">SMS ERP</span>
          </Link>
        </div>

        <div className="p-4 sm:p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 sm:w-9 sm:h-9 ${roleColor} rounded-2xl flex items-center justify-center text-sm font-bold uppercase shrink-0 sm:text-xs`}>
              {(profile.name || profile.email || 'U')[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-900 truncate sm:text-sm sm:font-medium">{profile.name || profile.email}</p>
              <span className={`inline-block mt-1 text-xs px-2.5 py-1 rounded-full text-gray-900 font-medium ${roleColor}`}>
                {role}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base transition-all duration-200 group hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold shrink-0 ${
                    isActive 
                      ? 'text-blue-700' 
                      : 'text-gray-400 group-hover:text-gray-600'
                  }`}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 space-y-1">
          {canAccessRoute(role, '/dashboard/client') && (
            <Link
              href="/dashboard/client"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span>History</span> Request History
            </Link>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 active:scale-[0.98] transition-all duration-200"
          >
            <span className="w-6 h-6 rounded bg-red-500/20 text-red-300 flex items-center justify-center shrink-0">↗</span>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-30 shadow-sm">
          <button 
            className="lg:hidden p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all duration-200 active:scale-95 min-w-[44px] h-[44px] flex items-center justify-center" 
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          <Link 
            href="/dashboard/notifications" 
            className="relative p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all duration-200 min-w-[44px] h-[44px] flex items-center justify-center group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11 6 0v-1m-6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold shadow-lg border-2 border-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <div className={`w-10 h-10 sm:w-8 sm:h-8 ${roleColor} rounded-2xl flex items-center justify-center text-sm font-bold uppercase shadow-lg sm:text-xs sm:font-medium shrink-0`}>
            {(profile.name || profile.email || 'U')[0]}
          </div>
        </header>

        <main className="flex-1 overflow-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
