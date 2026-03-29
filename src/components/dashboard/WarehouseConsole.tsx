'use client';

import { useMemo } from 'react';
import type { DbRequest, InventoryLog, Product } from '@/types/types';
import { formatRelative } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductList } from '@/components/dashboard/ProductList';

interface WarehouseConsoleProps {
  requests: DbRequest[];
  products: Product[];
  inventoryLogs: InventoryLog[];
  stockInputs: Record<string, number>;
  setStockInputs: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  processingId: string | null;
  updateOrder: (request: DbRequest, status: 'preparing' | 'ready') => Promise<void>;
  updateStock: (product: Product) => Promise<void>;
  handleEditProduct: (product: Product) => void;
  handleDeleteProduct: (id: string) => Promise<void>;
  onAddProduct: () => void;
}

export function WarehouseConsole({
  requests,
  products,
  inventoryLogs,
  stockInputs,
  setStockInputs,
  processingId,
  updateOrder,
  updateStock,
  handleEditProduct,
  handleDeleteProduct,
  onAddProduct,
}: WarehouseConsoleProps) {
  const byStatus = useMemo(
    () => ({
      invoice_ready: requests.filter((r) => r.status === 'invoice_ready'),
      preparing: requests.filter((r) => r.status === 'preparing'),
      ready: requests.filter((r) => r.status === 'ready'),
    }),
    [requests]
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= (p.min_stock ?? 5)).length,
    [products]
  );

  return (
    <div className="space-y-12">
      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <StatCard
          label="Low Stock Items"
          value={lowStockCount}
          color={lowStockCount > 0 ? 'red' : 'gray'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
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

      {/* Inventory Management Section */}
      <section className="bg-white border border-apple-gray-border rounded-2xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-apple-blue/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <h2 className="text-2xl font-bold text-apple-text-primary tracking-tight">
              Real-time Inventory
            </h2>
            <p className="text-apple-text-secondary text-sm font-medium mt-1">
              Adjust stock levels and monitor availability.
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No Products"
            description="Add products to start managing inventory."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-apple-gray-border bg-apple-gray-bg/50 p-5 hover:bg-white hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-apple-text-primary truncate">{product.name}</p>
                    <p className="text-xs text-apple-text-secondary mt-0.5">
                      {product.category || 'General'} &middot; {product.unit}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      product.stock > (product.min_stock ?? 5)
                        ? 'bg-apple-success/10 text-apple-success'
                        : product.stock > 0
                          ? 'bg-apple-warning/10 text-apple-warning'
                          : 'bg-apple-danger/10 text-apple-danger'
                    }`}
                  >
                    {product.stock > 0 ? `${product.stock} ${product.unit}` : 'OUT'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      value={stockInputs[product.id] ?? product.stock}
                      onChange={(e) =>
                        setStockInputs((prev) => ({
                          ...prev,
                          [product.id]: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-white border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm font-bold text-apple-text-primary focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-apple-text-secondary">
                      QTY
                    </span>
                  </div>
                  <button
                    onClick={() => updateStock(product)}
                    disabled={processingId === product.id || stockInputs[product.id] === product.stock}
                    className="px-6 bg-apple-blue hover:bg-apple-blue-hover text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"
                  >
                    {processingId === product.id ? '...' : 'SAVE'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Product Catalog Section */}
      <section className="pt-12 border-t border-apple-gray-border">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-apple-text-primary tracking-tight">Catalog Items</h2>
            <p className="text-apple-text-secondary text-sm font-medium mt-1">
              Manage products in the warehouse catalog.
            </p>
          </div>
          <button
            onClick={onAddProduct}
            className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue-hover text-white text-xs font-bold px-5 py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-apple-blue/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            ADD PRODUCT
          </button>
        </div>

        <ProductList
          products={products}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
          isAdmin={true}
        />
      </section>

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
