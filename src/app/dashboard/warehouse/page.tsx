'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { inventoryService, productService, workflowEngine, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { DbRequest, InventoryLog, Product, Actor } from '@/types/types';

import { WarehouseConsole } from '@/components/dashboard/WarehouseConsole';
import { AddProductPanel } from '@/components/dashboard/AddProductPanel';
import { ProductForm } from '@/components/dashboard/ProductForm';

export default function WarehouseDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Panel state
  const [warehouseView, setWarehouseView] = useState<'console' | 'add-product'>('console');

  // Data state
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  // Sync state with URL
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'add-product') setWarehouseView('add-product');
    else setWarehouseView('console');
  }, [searchParams]);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/warehouse')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Build actor helper
  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return {
      id: user.id,
      email: user.email ?? profile?.email,
      role: role,
    };
  }, [profile, role]);

  // Data fetch
  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await inventoryService.getWarehouseDashboard();
      setRequests(data.requests);
      setProducts(data.products);
      setInventoryLogs(data.recentLogs);
      setStockInputs(
        data.products.reduce<Record<string, number>>((acc, product) => {
          acc[product.id] = product.stock;
          return acc;
        }, {})
      );
    } catch (err) {
      console.error('Warehouse refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // Realtime subscriptions
  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('products', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('inventory_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  // Order status transition
  const updateOrder = useCallback(
    async (request: DbRequest, status: 'preparing' | 'ready') => {
      if (!profile) return;
      setProcessingId(request.id);
      try {
        const actor = await getActor();

        // When preparing, consume stock first
        if (status === 'preparing') {
          await inventoryService.consumeStockForPreparing(request, actor);
        }

        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: status,
          action: status,
          message: status === 'preparing' ? `Preparing order` : `Order is ready for pickup`,
          type: status === 'ready' ? 'success' : 'info',
          notifyRoles: status === 'ready' ? ['technician', 'admin'] : ['admin'],
          metadata: { previous_status: request.status },
        });
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setProcessingId(null);
      }
    },
    [profile, getActor, refresh]
  );

  // Stock adjustment
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

  // Product management
  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteProduct = useCallback(
    async (id: string) => {
      if (!confirm('Delete this product?')) return;
      try {
        const actor = await getActor();
        await productService.delete(id, actor);
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [getActor, refresh]
  );

  const handleSaveProduct = useCallback(
    async (data: Partial<Product>, imageFile?: File) => {
      try {
        const actor = await getActor();
        if (editingProduct) {
          await productService.update(editingProduct.id, data, imageFile, actor);
        } else {
          await productService.create(
            data as { name: string; description?: string; sku?: string; category?: Product['category']; stock?: number; min_stock?: number; unit?: string },
            imageFile,
            actor
          );
        }
        setIsEditModalOpen(false);
        setEditingProduct(undefined);
        setWarehouseView('console');
        router.push('/dashboard/warehouse');
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Save failed');
        throw err;
      }
    },
    [editingProduct, getActor, refresh, router]
  );

  // Loading state
  if (loading || (fetching && products.length === 0 && requests.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  // Error state
  if (error && products.length === 0 && requests.length === 0) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {warehouseView === 'console' ? (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Warehouse Console
            </h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">
              Global inventory and fulfillment tracking.
            </p>
          </div>
          <WarehouseConsole
            requests={requests}
            products={products}
            inventoryLogs={inventoryLogs}
            stockInputs={stockInputs}
            setStockInputs={setStockInputs}
            processingId={processingId}
            updateOrder={updateOrder}
            updateStock={updateStock}
            handleEditProduct={handleEditProduct}
            handleDeleteProduct={handleDeleteProduct}
          />
        </div>
      ) : (
        <div className="animate-in slide-in-from-right-4 fade-in duration-500">
          <AddProductPanel
            onSave={handleSaveProduct}
            onCancel={() => {
              setWarehouseView('console');
              router.push('/dashboard/warehouse');
            }}
          />
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <ProductForm
          product={editingProduct}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}
