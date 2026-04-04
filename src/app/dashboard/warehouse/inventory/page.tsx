'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { inventoryService, authService } from '@/lib/services';
import { requireAuthUser, inventoryLogsDb } from '@/lib/db';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Product, Actor, InventoryLog } from '@/types/types';
import { formatRelative } from '@/lib/format-utils';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function InventoryDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/warehouse/inventory')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return {
      id: user.id,
      email: user.email ?? profile?.email,
      role: role,
    };
  }, [profile, role]);

  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      let query = supabase.from('products').select('*').order('name');
      if (activeBranchId && activeBranchId !== 'ALL') {
        query = query.eq('branch_id', activeBranchId);
      }
      
      const [productsResult, logsResult] = await Promise.all([
        query,
        inventoryLogsDb.getRecent(30, activeBranchId)
      ]);
        
      if (productsResult.error) throw productsResult.error;
      
      setProducts(productsResult.data as Product[]);
      setInventoryLogs(logsResult);
      setStockInputs(
        (productsResult.data as Product[]).reduce<Record<string, number>>((acc, product) => {
          acc[product.id] = product.stock;
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setFetching(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh, activeBranchId]);

  useRealtimeTable('products', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('inventory_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  const updateStock = useCallback(
    async (product: Product) => {
      if (!profile) return;
      setProcessingId(product.id);
      try {
        const actor = await getActor();
        const nextStock = Number(stockInputs[product.id] ?? product.stock);
        const change = nextStock - product.stock;

        if (change !== 0) {
          await inventoryService.adjustStock(
            product.id,
            change,
            'manual_adjustment',
            actor
          );
        }
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Stock update failed');
      } finally {
        setProcessingId(null);
      }
    },
    [profile, getActor, stockInputs, refresh]
  );

  if (loading || (fetching && products.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <section className="bg-white border border-apple-gray-border rounded-2xl p-8 sm:p-12 shadow-sm relative overflow-hidden animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-apple-blue/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">
              Real-time Inventory
            </h1>
            <p className="text-apple-text-secondary text-sm font-medium mt-1">
              Adjust global warehouse stock levels and monitor availability.
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

                {product.stock <= (product.min_stock ?? 5) && (
                  <Link 
                    href={`/dashboard/warehouse/request-purchase?product_id=${product.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-50 px-4 py-2 mb-4 text-xs font-bold text-orange-600 border border-orange-100 transition-colors hover:bg-orange-100"
                  >
                    <span>⚠️ Low Stock — Request Purchase</span>
                  </Link>
                )}

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

      {/* Activity Log Section */}
      <section className="bg-apple-gray-bg border border-apple-gray-border rounded-2xl p-8 sm:p-12 mt-12">
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
