'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { authService } from '@/lib/services/auth-service';
import { canAccessRoute } from '@/lib/permissions';
import { chatService } from '@/lib/services/chat-service';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { BranchSwitcher } from '@/components/dashboard/BranchSwitcher';
import { NAV_ITEMS } from '@/lib/navigation';
import { PageSpinner } from '@/components/ui/LoadingSkeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, role } = useAuth();
  useHeartbeat(profile?.id);
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isChatAnimating, setIsChatAnimating] = useState(false);

  const toggleChat = useCallback(() => {
    if (isChatAnimating) return;
    setIsChatAnimating(true);
    setChatOpen(prev => !prev);
    setTimeout(() => setIsChatAnimating(false), 350); // Matches the maximum CSS transition duration
  }, [isChatAnimating]);

  // Auth redirect
  useEffect(() => {
    if (!loading && !profile) {
      router.push('/login');
    }
  }, [loading, profile, router]);

  // Profile completion guard — clients must complete setup first
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role === 'client' && !authService.isProfileComplete(profile)) {
      if (pathname !== '/dashboard/client/setup') {
        router.replace('/dashboard/client/setup');
      }
    }
  }, [loading, profile, pathname, router]);

  // Route guard
  useEffect(() => {
    if (loading || !profile) return;
    if (pathname === '/dashboard') return;
    // Don't redirect away from setup page
    if (pathname === '/dashboard/client/setup') return;

    const hasDirectAccess = canAccessRoute(profile.role, pathname);
    const hasNestedAccess = NAV_ITEMS.some(
      item => pathname.startsWith(item.href + '/') && canAccessRoute(profile.role, item.href)
    );

    if (!hasDirectAccess && !hasNestedAccess) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, pathname, profile, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const canChat = profile?.role ? chatService.canUseChat(profile.role) : false;

  const visibleNav = NAV_ITEMS.filter(item => canAccessRoute(role, item.href));
  const currentPageLabel = visibleNav.find(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )?.label ?? 'Dashboard';

  if (loading) return <PageSpinner />;
  if (!profile) return null;

  return (
    <div className="flex min-h-screen bg-[var(--apple-gray-bg)] text-[var(--apple-text-primary)] antialiased">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[35] bg-black/20 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--apple-gray-border)] bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="hidden text-sm font-semibold tracking-tight sm:block">
              {currentPageLabel}
            </h2>
            <BranchSwitcher />
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />

            {canChat && (
              <button
                onClick={toggleChat}
                disabled={isChatAnimating}
                className={`relative rounded-lg p-2 transition-colors ${isChatAnimating ? 'text-gray-400 cursor-default' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                aria-label="Toggle chat"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </button>
            )}

            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold uppercase text-blue-600 ring-1 ring-blue-100">
              {(profile.name ?? profile.email ?? 'U')[0]}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="custom-scrollbar flex-1 overflow-y-auto bg-white p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Chat panel */}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
