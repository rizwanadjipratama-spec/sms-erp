'use client';

import { useMemo } from 'react';
import type { DbRequest, InventoryLog } from '@/types/types';
import { formatRelative } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderNotes } from '@/components/ui';

interface WarehouseConsoleProps {
  requests: DbRequest[];
  processingId: string | null;
  updateOrder: (request: DbRequest, status: 'preparing' | 'ready') => Promise<void>;
}

export function WarehouseConsole({
  requests,
  processingId,
  updateOrder,
}: WarehouseConsoleProps) {
  const byStatus = useMemo(
    () => ({
      invoice_ready: requests.filter((r) => r.status === 'invoice_ready'),
      preparing: requests.filter((r) => r.status === 'preparing'),
      ready: requests.filter((r) => r.status === 'ready'),
    }),
    [requests]
  );

  return (
    <div className="space-y-12">
      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Pending Fulfillment"
          value={byStatus.invoice_ready.length}
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          label="Currently Preparing"
          value={byStatus.preparing.length}
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Ready for Tech"
          value={byStatus.ready.length}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Workflow Section */}
      <div className="grid lg:grid-cols-2 gap-8">
        {[
          {
            title: 'Incoming: Invoice Ready',
            items: byStatus.invoice_ready,
            nextStatus: 'preparing' as const,
            nextLabel: 'START PREPARING',
          },
          {
            title: 'In Progress: Preparing',
            items: byStatus.preparing,
            nextStatus: 'ready' as const,
            nextLabel: 'MARK AS READY',
          },
        ].map((section) => (
          <section key={section.title} className="space-y-4">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-xl font-bold text-apple-text-primary tracking-tight">
                {section.title}
              </h2>
              <span className="text-xs font-bold text-apple-text-secondary uppercase tracking-widest">
                {section.items.length} orders
              </span>
            </div>

            {section.items.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No orders in this stage"
                description="Orders will appear here as they progress through the workflow."
              />
            ) : (
              <div className="space-y-4">
                {section.items.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white border border-apple-gray-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-bold text-apple-text-primary text-sm">
                          {request.user_email || 'Client'}
                        </p>
                        <p className="text-xs text-apple-text-secondary mt-0.5">
                          {formatRelative(request.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={request.status} />
                        {request.branch && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            {request.branch.name}
                          </span>
                        )}
                        {request.priority === 'cito' && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-apple-danger/10 text-apple-danger uppercase">
                            {request.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-6 bg-apple-gray-bg p-4 rounded-xl border border-apple-gray-border">
                      {(request.request_items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-medium">
                          <span className="text-apple-text-secondary">
                            {item.products?.name || item.product_id}
                          </span>
                          <span className="text-apple-text-primary font-bold">x{item.quantity}</span>
                        </div>
                      ))}
                      {(!request.request_items || request.request_items.length === 0) && (
                        <p className="text-xs text-apple-text-secondary text-center italic">No items found</p>
                      )}
                    </div>

                    <div className="mb-6">
                      <OrderNotes
                        requestId={request.id}
                        allowedTargetRoles={['courier', 'finance']}
                        compact
                      />
                    </div>

                    <button
                      onClick={() => updateOrder(request, section.nextStatus)}
                      disabled={processingId === request.id}
                      className="w-full py-3 bg-apple-text-primary hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 tracking-wider uppercase"
                    >
                      {processingId === request.id ? 'UPDATING...' : section.nextLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
