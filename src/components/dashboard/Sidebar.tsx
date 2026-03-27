'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarButton } from './SidebarButton';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { NAV_ITEMS } from '@/lib/navigation';

interface SidebarProps {

  isOpen: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, unreadCount }) => {
  const pathname = usePathname();
  const { profile, logout } = useAuth();

  if (!profile) return null;

  const role = profile.role || 'user';
  const visibleNav = NAV_ITEMS.filter((item) => canAccessRoute(role, item.href));

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen w-64 bg-apple-gray-bg border-r border-apple-gray-border z-40 
        flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      <div className="p-6 border-b border-apple-gray-border flex-shrink-0">
        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
          <div className="w-8 h-8 bg-apple-blue rounded-apple flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <span className="text-lg font-bold text-apple-text-primary">SMS ERP</span>
        </Link>
      </div>

      <div className="p-4 border-b border-apple-gray-border flex-shrink-0 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-apple-blue/10 text-apple-blue rounded-full flex items-center justify-center text-sm font-bold uppercase shrink-0">
            {(profile.name || profile.email || 'U')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-apple-text-primary truncate">{profile.name || profile.email}</p>
            <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-apple-blue-light text-apple-blue font-bold uppercase tracking-wider">
              {role}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {visibleNav.map((item) => (
          <SidebarButton
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))}
            onClick={onClose}
            showBadge={item.href === '/dashboard/notifications'}
            badgeCount={unreadCount}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-apple-gray-border space-y-1 bg-white/30 backdrop-blur-sm">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-apple text-sm font-medium text-apple-danger hover:bg-apple-danger/10 transition-all duration-200"
        >
          <span className="flex items-center justify-center w-5 h-5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};
