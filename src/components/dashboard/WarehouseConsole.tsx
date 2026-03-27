'use client';

import { useMemo } from 'react';
import type { DbRequest, InventoryLog, Product } from '@/types/types';
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
}: WarehouseConsoleProps) {
  const byStatus = useMemo(
    () => ({
      invoice_ready: requests.filter((request) => request.status === 'invoice_ready'),
      preparing: requests.filter((request) => request.status === 'preparing'),
      ready: requests.filter((request) => request.status === 'ready'),
    }),
    [requests]
  );

  return (
    <div className="space-y-12">
      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Pending Fulfillment', value: byStatus.invoice_ready.length, color: 'text-apple-blue', bg: 'bg-apple-blue/5' },
          { label: 'Currently Preparing', value: byStatus.preparing.length, color: 'text-apple-warning', bg: 'bg-apple-warning/5' },
          { label: 'Ready for Tech', value: byStatus.ready.length, color: 'text-apple-success', bg: 'bg-apple-success/5' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-apple-gray-border rounded-[1.5rem] p-6 text-center transition-all hover:scale-[1.02] duration-300`}>
            <p className="text-apple-text-secondary text-[10px] font-black uppercase tracking-widest mb-2">{stat.label}</p>
            <p className={`text-4xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
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
               <h2 className="text-xl font-black text-apple-text-primary tracking-tight">{section.title}</h2>
               <span className="text-[10px] font-bold text-apple-text-secondary">{section.items.length} ORDERS</span>
            </div>
            
            {section.items.length === 0 ? (
              <div className="bg-apple-gray-bg/50 border border-apple-gray-border rounded-[2rem] p-12 text-center">
                <p className="text-apple-text-secondary text-xs font-bold uppercase tracking-widest leading-loose">No orders in this stage</p>
              </div>
            ) : (
              <div className="space-y-4">
                {section.items.map((request) => (
                  <div key={request.id} className="bg-white border border-apple-gray-border rounded-apple p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-bold text-apple-text-primary text-sm">{request.user_email || 'Client'}</p>
                        <p className="text-[10px] text-apple-text-secondary font-black tracking-wider uppercase mt-0.5">
                          {new Date(request.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter ${request.priority === 'cito' ? 'bg-apple-danger/10 text-apple-danger' : 'bg-apple-gray-bg text-apple-text-secondary'}`}>
                        {request.priority}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-6 bg-apple-gray-bg/50 p-4 rounded-xl border border-apple-gray-border/30">
                      {request.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-medium">
                          <span className="text-apple-text-secondary">{item.name || 'Unknown Item'}</span>
                          <span className="text-apple-text-primary font-black">x{item.qty}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => updateOrder(request, section.nextStatus)}
                      disabled={processingId === request.id}
                      className="w-full py-3 bg-apple-text-primary hover:bg-black text-white text-[10px] font-black rounded-xl shadow-lg shadow-black/5 active:scale-95 transition-all disabled:opacity-50 tracking-widest"
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
      <section className="bg-white border border-apple-gray-border rounded-[2rem] p-8 sm:p-12 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-apple-blue/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <h2 className="text-2xl font-black text-apple-text-primary tracking-tight">Real-time Inventory</h2>
            <p className="text-apple-text-secondary text-sm font-medium mt-1">Adjust stock levels and monitor availability.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-apple-gray-border bg-apple-gray-bg/30 p-5 hover:bg-white hover:shadow-xl transition-all duration-500 group">
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-apple-text-primary truncate">{product.name}</p>
                  <p className="text-[10px] font-bold text-apple-text-secondary uppercase tracking-widest mt-0.5">{product.category || 'General'}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${product.stock > 0 ? 'bg-apple-success/10 text-apple-success' : 'bg-apple-danger/10 text-apple-danger'}`}>
                  {product.stock > 0 ? 'IN STOCK' : 'OUT'}
                </span>
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                   <input
                    type="number"
                    min="0"
                    value={stockInputs[product.id] ?? product.stock}
                    onChange={(e) => setStockInputs(prev => ({ ...prev, [product.id]: Number(e.target.value) }))}
                    className="w-full bg-white border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm font-bold text-apple-text-primary focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-apple-text-secondary">QTY</span>
                </div>
                <button
                  onClick={() => updateStock(product)}
                  disabled={processingId === product.id}
                  className="px-6 bg-apple-blue hover:bg-apple-blue-hover text-white text-[10px] font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-apple-blue/10"
                >
                  {processingId === product.id ? '...' : 'SAVE'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Management Section */}
      <section className="pt-12 border-t border-apple-gray-border">
        <div className="mb-8">
            <h2 className="text-3xl font-black text-apple-text-primary tracking-tight">Catalog Items</h2>
            <p className="text-apple-text-secondary text-sm font-medium mt-1">Edit or remove existing items from the public catalog.</p>
        </div>

        <ProductList 
          products={products}
          isAdmin={true}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
        />
      </section>

      {/* History Section */}
      <section className="bg-apple-gray-bg/30 border border-apple-gray-border rounded-[2rem] p-8 sm:p-12">
        <div className="mb-8">
          <h2 className="text-xl font-black text-apple-text-primary tracking-tight">Activity Log</h2>
          <p className="text-apple-text-secondary text-sm font-medium mt-1">Audit trail of all inventory movements.</p>
        </div>
        
        {inventoryLogs.length === 0 ? (
          <p className="text-xs font-bold text-apple-text-secondary uppercase tracking-widest text-center py-10">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {inventoryLogs.map((log) => (
              <div key={log.id} className="bg-white border border-apple-gray-border rounded-2xl p-4 flex items-center justify-between gap-4 group hover:border-apple-blue/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-apple-text-primary truncate">
                    Product ID: {log.product_id.split('-')[0]}...
                    {log.order_id ? <span className="text-apple-text-secondary font-medium"> • Order {log.order_id.split('-')[0]}...</span> : null}
                  </p>
                  <p className="text-[10px] font-black text-apple-text-secondary uppercase tracking-widest mt-1">
                    {log.reason.replace(/_/g, ' ')} • {new Date(log.created_at).toLocaleTimeString('id-ID')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${log.change >= 0 ? 'text-apple-success' : 'text-apple-danger'}`}>
                    {log.change >= 0 ? '+' : ''}{log.change}
                  </p>
                  <p className="text-[10px] font-bold text-apple-text-secondary truncate max-w-[80px]">{log.by_user || 'SYSTEM'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
