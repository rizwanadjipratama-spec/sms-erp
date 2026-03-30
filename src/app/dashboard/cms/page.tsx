'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { DashboardSkeleton, ErrorState } from '@/components/ui';
import CmsGeneralTab from './components/CmsGeneralTab';
import CmsNewsTab from './components/CmsNewsTab';
import CmsEventsTab from './components/CmsEventsTab';
import CmsPartnersTab from './components/CmsPartnersTab';

type TabKey = 'general' | 'news' | 'events' | 'partners';

export default function CmsDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('general');

  // Strict Auth Guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/cms')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  // Double check in render to prevent flashes
  if (!canAccessRoute(profile.role, '/dashboard/cms')) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-2xl border border-[var(--apple-border)] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">CMS System</h1>
          <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">Manage the main website content dynamically.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([
          { key: 'general' as TabKey, label: 'General Content' },
          { key: 'news' as TabKey, label: 'News & Updates' },
          { key: 'events' as TabKey, label: 'Events' },
          { key: 'partners' as TabKey, label: 'Partners' },
        ]).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              tab === item.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'general' && <CmsGeneralTab />}
        {tab === 'news' && <CmsNewsTab />}
        {tab === 'events' && <CmsEventsTab />}
        {tab === 'partners' && <CmsPartnersTab />}
      </div>
    </div>
  );
}
