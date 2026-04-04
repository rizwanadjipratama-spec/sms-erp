'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { productService, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { Product, Actor } from '@/types/types';
import { supabase } from '@/lib/supabase';

import { AddProductPanel } from '@/components/dashboard/AddProductPanel';
import { ProductForm } from '@/components/dashboard/ProductForm';
import { ProductList } from '@/components/dashboard/ProductList';

export default function CatalogDashboard() {
  const { profile, role, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [catalogView, setCatalogView] = useState<'catalog' | 'add-product'>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'add-product') setCatalogView('add-product');
    else setCatalogView('catalog');
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/warehouse/catalog')) {
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
      let query = supabase
        .from('products')
        .select('*')
        .is('technician_id', null)
        .order('name');
      
      if (activeBranchId && activeBranchId !== 'ALL') {
        query = query.eq('branch_id', activeBranchId);
      }
        
      const { data, error: dbError } = await query;
      if (dbError) throw dbError;
      setProducts(data as Product[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
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
      if (!editingProduct && activeBranchId === 'ALL') {
        alert('Mohon pilih spesifik cabang (contoh: Bogor, Cirebon) di kanan atas sebelum menambah produk agar data gudang tidak tumpang tindih.');
        return;
      }
      try {
        const actor = await getActor();
        if (editingProduct) {
          await productService.update(editingProduct.id, data as any, imageFile, actor);
        } else {
          await productService.create(
            { ...data, branch_id: activeBranchId } as any,
            imageFile,
            actor
          );
        }
        setIsEditModalOpen(false);
        setEditingProduct(undefined);
        setCatalogView('catalog');
        router.push('/dashboard/warehouse/catalog');
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Save failed');
        throw err;
      }
    },
    [editingProduct, getActor, refresh, router]
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
      {catalogView === 'catalog' ? (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
              <div>
                <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">
                  Catalog Items
                </h1>
                <p className="text-apple-text-secondary text-sm font-medium mt-1">
                  Manage products, specifications, and central definitions.
                </p>
              </div>
              <button
                disabled={activeBranchId === 'ALL'}
                onClick={() => {
                  setCatalogView('add-product');
                  router.push('/dashboard/warehouse/catalog?view=add-product');
                }}
                title={activeBranchId === 'ALL' ? "Pilih cabang spesifik di atas untuk menambah produk" : ""}
                className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-apple-blue/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                ADD PRODUCT
              </button>
            </div>
          </div>
          <ProductList
            products={products}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            isAdmin={true}
          />
        </div>
      ) : (
        <div className="animate-in slide-in-from-right-4 fade-in duration-500">
          <AddProductPanel
            onSave={handleSaveProduct}
            onCancel={() => {
              setCatalogView('catalog');
              router.push('/dashboard/warehouse/catalog');
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
