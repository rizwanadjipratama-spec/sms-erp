'use client';

import { useMemo } from 'react';
import type { DbRequest, InventoryLog } from '@/types/types';
import { formatRelative } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

interface WarehouseConsoleProps {
  requests: DbRequest[];
  inventoryLogs: InventoryLog[];
  processingId: string | null;
  updateOrder: (request: DbRequest, status: 'preparing' | 'ready') => Promise<void>;
}

export function WarehouseConsole({
  requests,
  inventoryLogs,
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



      {/* Activity Log Section */}
      <section className="bg-apple-gray-bg border border-apple-gray-border rounded-2xl p-8 sm:p-12">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-apple-text-primary tracking-tight">Activity Log</h2>
          <p className="text-apple-text-secondary text-sm font-medium mt-1">
            Audit trail of all inventory movements.
          </p>
        </div>

        {inventoryLogs.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No Recent Activity"
            description="Inventory movements will appear here."
          />
        ) : (
          <div className="space-y-3">
            {inventoryLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-apple-gray-border rounded-xl p-4 flex items-center justify-between gap-4 hover:border-apple-blue/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-apple-text-primary truncate">
                    {log.product?.name || log.product_id.split('-')[0]}
                  </p>
                  <p className="text-xs text-apple-text-secondary mt-1">
                    {log.reason.replace(/_/g, ' ')} &middot; {formatRelative(log.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold ${
                      log.change >= 0 ? 'text-apple-success' : 'text-apple-danger'
                    }`}
                  >
                    {log.change >= 0 ? '+' : ''}
                    {log.change}
                  </p>
                  <p className="text-[10px] text-apple-text-secondary truncate max-w-[80px]">
                    bal: {log.balance}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
