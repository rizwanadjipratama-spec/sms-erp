'use client';

import { STATUS_LABELS, STATUS_COLORS } from '@/lib/services/workflow-engine';
import type { RequestStatus } from '@/types/types';

// Extended status colors for ORION business statuses
const EXTENDED_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-600',
  paid: 'bg-emerald-100 text-emerald-700',
  partial_paid: 'bg-amber-100 text-amber-700',
  ordered: 'bg-indigo-100 text-indigo-700',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-teal-100 text-teal-700',
  received: 'bg-green-100 text-green-700',
  partial_received: 'bg-lime-100 text-lime-700',
  requested: 'bg-yellow-100 text-yellow-700',
  in_transit: 'bg-blue-100 text-blue-700',
  disbursed: 'bg-emerald-100 text-emerald-700',
  settled: 'bg-green-100 text-green-700',
};

interface StatusBadgeProps {
  status: RequestStatus | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const label = STATUS_LABELS[status as RequestStatus] ?? status.replace(/_/g, ' ');
  const color = STATUS_COLORS[status as RequestStatus] ?? EXTENDED_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium capitalize ${color} ${sizeClasses}`}>
      {label}
    </span>
  );
}
