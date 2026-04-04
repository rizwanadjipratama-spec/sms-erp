'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getNavigationForProfile } from '@/lib/navigation';
import { supabase } from '@/lib/db/client';
import type { AppFeature } from '@/lib/features';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, logout, role, setProfile } = useAuth();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDrop = useCallback(async (fromIdx: number, toIdx: number) => {
    if (!profile || fromIdx === toIdx) return;
    const features = [...(profile.features || [])] as AppFeature[];
    const [moved] = features.splice(fromIdx, 1);
    features.splice(toIdx, 0, moved);

    // Optimistic: update local profile
    setProfile?.({ ...profile, features });
    try {
      await supabase.from('profiles').update({ features }).eq('id', profile.id);
    } catch {
      // Revert on failure
      setProfile?.(profile);
    }
  }, [profile, setProfile]);

  if (!profile) return null;

  const visibleNav = getNavigationForProfile(profile);

  const activeItem = React.useMemo(() => {
    return [...visibleNav]
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (item) =>
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
      );
  }, [pathname, visibleNav]);

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

      {/* Navigation — draggable */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {visibleNav.map((item, idx) => {
            const isActive = activeItem?.href === item.href;
            const isDragging = dragIdx === idx;
            const isDragOver = overIdx === idx && dragIdx !== idx;
            return (
              <div
                key={item.href}
                draggable
                onDragStart={(e) => {
                  setDragIdx(idx);
                  setOverIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setOverIdx(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) handleDrop(dragIdx, idx);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`flex items-center rounded-apple text-sm font-medium transition-all duration-200 select-none ${
                  isDragging
                    ? 'opacity-30'
                    : isDragOver
                    ? 'ring-2 ring-blue-400 ring-offset-1'
                    : ''
                }`}
              >
                {/* Drag handle */}
                <span
                  className="flex-shrink-0 cursor-grab active:cursor-grabbing px-1.5 py-2.5 text-gray-300 hover:text-gray-500 transition-colors"
                  title="Seret untuk pindahkan"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.8" /><circle cx="15" cy="6" r="1.8" />
                    <circle cx="9" cy="12" r="1.8" /><circle cx="15" cy="12" r="1.8" />
                    <circle cx="9" cy="18" r="1.8" /><circle cx="15" cy="18" r="1.8" />
                  </svg>
                </span>

                {/* Nav link */}
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex-1 py-2.5 pr-3 rounded-apple transition-colors ${
                    isActive
                      ? 'text-[var(--apple-blue)] font-bold'
                      : 'text-apple-text-secondary hover:text-apple-blue'
                  }`}
                >
                  {item.label}
                </Link>
              </div>
            );
          })}
        </div>
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
