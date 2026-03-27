'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { inventoryService } from '@/lib/inventory-service';
import { canAccessRoute } from '@/lib/permissions';
import type { DbRequest, InventoryLog, Product } from '@/types/types';
import { getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';

export default function WarehouseDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/warehouse')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    const { requests: nextRequests, products: nextProducts, inventoryLogs: nextLogs } =
      await inventoryService.fetchWarehouseDashboardData();

    setRequests(nextRequests);
    setProducts(nextProducts);
    setInventoryLogs(nextLogs);
    setStockInputs(
      nextProducts.reduce<Record<string, number>>((acc, product) => {
        acc[product.id] = product.stock;
        return acc;
      }, {})
    );
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('requests', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'warehouse-requests',
  });

  useRealtimeTable('products', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'warehouse-products',
  });

  useRealtimeTable('inventory_logs', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'warehouse-inventory-logs',
  });

  const updateOrder = async (request: DbRequest, status: 'preparing' | 'ready') => {
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId(request.id);
    try {
      if (!profile) throw new Error('Authentication profile not loaded'); // Added guard
      const actor = await getCurrentAuthUser();
      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile.role,
        nextStatus: status,
        action: status,
        message:
          status === 'preparing'
            ? `Warehouse started preparing request ${request.id}`
            : `Request ${request.id} is ready for technician pickup`,
        type: status === 'ready' ? 'success' : 'info',
        notifyRoles: status === 'ready' ? ['technician', 'admin', 'owner'] : ['admin', 'owner'],
        metadata: {
          previous_status: request.status,
        },
      });

      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Warehouse update failed');
    } finally {
      setProcessingId(null);
    }
  };

  const updateStock = async (product: Product) => {
    if (!profile) {
      alert('Authentication profile not loaded');
      return;
    }

    setProcessingId(product.id);
    try {
      const actor = await getCurrentAuthUser();
      const nextStock = Number(stockInputs[product.id] ?? product.stock);
      await inventoryService.adjustStock({
        product,
        nextStock,
        actor: {
          id: actor.id,
          email: actor.email || profile?.email,
          role: profile.role,
        },
        reason: 'manual_adjustment',
      });

      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Stock update failed');
    } finally {
      setProcessingId(null);
    }
  };

  const byStatus = useMemo(
    () => ({
      invoice_ready: requests.filter((request) => request.status === 'invoice_ready'),
      preparing: requests.filter((request) => request.status === 'preparing'),
      ready: requests.filter((request) => request.status === 'ready'),
    }),
    [requests]
  );

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">Warehouse</h1>
        <p className="text-apple-text-secondary text-sm mt-1">Prepare invoice-ready orders and manage inventory levels.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Invoice Ready', value: byStatus.invoice_ready.length, color: 'text-apple-blue' },
          { label: 'Preparing', value: byStatus.preparing.length, color: 'text-apple-warning' },
          { label: 'Ready', value: byStatus.ready.length, color: 'text-apple-success' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-apple-gray-border rounded-apple p-5 text-center shadow-sm">
            <p className="text-apple-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-3xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5">
        <div className="space-y-5">
          {[
            {
              title: 'Invoice Ready',
              items: byStatus.invoice_ready,
              nextStatus: 'preparing' as const,
              nextLabel: 'Start Preparing',
            },
            {
              title: 'Preparing',
              items: byStatus.preparing,
              nextStatus: 'ready' as const,
              nextLabel: 'Mark Ready',
            },
          ].map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h2>
              {section.items.length === 0 ? (
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 text-center text-gray-500 text-sm">
                  No orders
                </div>
              ) : (
                <div className="space-y-3">
                  {section.items.map((request) => (
                    <div key={request.id} className="bg-white border border-apple-gray-border rounded-apple p-5 shadow-sm">
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div>
                          <p className="font-bold text-apple-text-primary text-sm">{request.user_email || request.user_id}</p>
                          <p className="text-xs text-apple-text-secondary font-medium">
                            {new Date(request.created_at).toLocaleString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-apple-gray-bg text-apple-text-secondary uppercase tracking-wider">
                          {request.priority}
                        </span>
                      </div>
                      <div className="text-xs text-apple-text-secondary mb-4 space-y-1 bg-apple-gray-bg p-3 rounded-lg border border-apple-gray-border/50">
                        {request.items.map((item, index) => (
                          <div key={`${request.id}-${index}`} className="flex justify-between">
                            <span>{item.name || item.id}</span>
                            <span className="font-bold">x{item.qty}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => updateOrder(request, section.nextStatus)}
                        disabled={processingId === request.id}
                        className="w-full py-2.5 bg-apple-blue hover:bg-apple-blue-hover text-white text-sm font-bold rounded-apple shadow-sm active:scale-95 transition-all disabled:opacity-50"
                      >
                        {processingId === request.id ? 'Updating...' : section.nextLabel}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Ready for Pickup</h2>
            {byStatus.ready.length === 0 ? (
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 text-center text-gray-500 text-sm">
                No orders waiting for technicians
              </div>
            ) : (
              <div className="space-y-3">
                {byStatus.ready.map((request) => (
                  <div key={request.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                    <p className="font-medium text-gray-900 text-sm">{request.user_email || request.user_id}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(request.created_at).toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-green-400 mt-3">Prepared and ready for technician pickup.</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h2>
          <div className="space-y-3">
            {products.map((product) => (
              <div key={product.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${product.stock > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {product.status}
                  </span>
                </div>
                <div className="flex gap-2">
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
                    className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => updateStock(product)}
                    disabled={processingId === product.id}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory History</h2>
            <p className="text-sm text-gray-500 mt-1">Every stock movement is logged for audit and reconciliation.</p>
          </div>
        </div>
        {inventoryLogs.length === 0 ? (
          <div className="text-sm text-gray-500">No inventory movements yet.</div>
        ) : (
          <div className="space-y-3">
            {inventoryLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-gray-200 bg-slate-950/50 p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-gray-900">
                    Product {log.product_id}
                    {log.order_id ? <span className="text-gray-500"> • Order {log.order_id}</span> : null}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {log.reason.replace(/_/g, ' ')} • {new Date(log.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${log.change >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {log.change >= 0 ? '+' : ''}
                    {log.change}
                  </p>
                  <p className="text-xs text-gray-500">{log.by_user || 'system'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
