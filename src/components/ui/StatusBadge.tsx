'use client';

import { STATUS_LABELS, STATUS_COLORS } from '@/lib/services/workflow-engine';
import type { RequestStatus } from '@/types/types';

interface StatusBadgeProps {
  status: RequestStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${color} ${sizeClasses}`}>
      {label}
    </span>
  );
}
