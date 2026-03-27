'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { inventoryService } from '@/lib/inventory-service';
import { canAccessRoute } from '@/lib/permissions';
import type { DbRequest, InventoryLog, Product } from '@/types/types';
import { getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';
import { productService } from '@/lib/product-service';

import { WarehouseConsole } from '@/components/dashboard/WarehouseConsole';
import { AddProductPanel } from '@/components/dashboard/AddProductPanel';
import { ProductForm } from '@/components/dashboard/ProductForm';

export default function WarehouseDashboard() {
  const { profile, loading } = useAuth();
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
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Legacy modal state (for editing existing products)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  // Sync state with URL to allow Sidebar control
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'add-product') setWarehouseView('add-product');
    else setWarehouseView('console');
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/warehouse')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
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
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setFetching(false);
    }
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
    if (!profile) return;
    setProcessingId(request.id);
    try {
      const actor = await getCurrentAuthUser();
      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile.role,
        nextStatus: status,
        action: status,
        message: status === 'preparing' ? `Preparing ${request.id}` : `Ready ${request.id}`,
        type: status === 'ready' ? 'success' : 'info',
        notifyRoles: status === 'ready' ? ['technician', 'admin'] : ['admin'],
        metadata: { previous_status: request.status },
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setProcessingId(null);
    }
  };

  const updateStock = async (product: Product) => {
    if (!profile) return;
    setProcessingId(product.id);
    try {
      const actor = await getCurrentAuthUser();
      const nextStock = Number(stockInputs[product.id] ?? product.stock);
      await inventoryService.adjustStock({
        product,
        nextStock,
        actor: { id: actor.id, email: actor.email, role: profile.role },
        reason: 'manual_adjustment',
      });
      await refresh();
    } catch (error) {
      alert('Stock update failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await productService.deleteProduct(id);
      await refresh();
    } catch (error) {
      alert('Delete failed');
    }
  };

  const handleSaveProduct = async (data: Partial<Product>, imageFile?: File) => {
    try {
      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, data, imageFile);
      } else {
        await productService.createProduct(data as Omit<Product, 'id' | 'created_at'>, imageFile);
      }
      setIsEditModalOpen(false);
      setEditingProduct(undefined);
      setWarehouseView('console'); // Switch back to console after adding
      // Update URL to match
      router.push('/dashboard/warehouse');
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Save failed');
      throw error;
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-apple-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {warehouseView === 'console' ? (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div>
            <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Warehouse Console</h1>
            <p className="text-apple-text-secondary text-sm mt-1 font-medium">Global inventory and fulfillment tracking.</p>
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

      {/* Edit Modal (Still useful for editing existing products from Console) */}
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
