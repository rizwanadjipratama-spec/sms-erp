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
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, logout, role } = useAuth();

  if (!profile) return null;

  const visibleNav = NAV_ITEMS.filter(item => canAccessRoute(role, item.href));

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r
        border-[var(--apple-gray-border)] bg-[var(--apple-gray-bg)] transition-transform
        duration-300 ease-in-out lg:static lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Logo */}
      <div className="flex-shrink-0 border-b border-[var(--apple-gray-border)] p-6">
        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            S
          </div>
          <span className="text-lg font-bold">SMS ERP</span>
        </Link>
      </div>

      {/* User info */}
      <div className="flex-shrink-0 border-b border-[var(--apple-gray-border)] bg-white/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold uppercase text-blue-600">
            {(profile.name ?? profile.email ?? 'U')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile.name ?? profile.email}</p>
            <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNav.map(item => (
          <SidebarButton
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            isActive={
              pathname === item.href
              || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            }
            onClick={onClose}
          />
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-[var(--apple-gray-border)] bg-white/30 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
