'use client';

import Link from 'next/link';
import React from 'react';

interface SidebarButtonProps {
  label: string;
  href: string;
  icon: string | React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
  showBadge?: boolean;
  badgeCount?: number;
}

export const SidebarButton: React.FC<SidebarButtonProps> = ({
  label,
  href,
  icon,
  isActive,
  onClick,
  showBadge,
  badgeCount,
}) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-2.5 rounded-apple text-sm font-medium
        transition-all duration-200 ease-in-out
        ${
          isActive
            ? 'bg-apple-blue text-white shadow-sm'
            : 'text-apple-text-secondary hover:bg-apple-blue-light hover:text-apple-blue'
        }
      `}
    >
      <span className="truncate flex-1 text-left">{label}</span>
      {showBadge && badgeCount !== undefined && badgeCount > 0 && (
        <span className={`
          ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center
          ${isActive ? 'bg-white/20 text-white' : 'bg-apple-danger text-white'}
        `}>
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </Link>
  );
};
