'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useRequest } from '@/lib/request-context';
import { productsDb } from '@/lib/db';
import { formatCurrency } from '@/lib/format-utils';
import { PageSpinner, EmptyState, ErrorState } from '@/components/ui';
import type { Product } from '@/types/types';

export default function ClientProductsPage() {
  const { profile, loading: authLoading } = useAuth();
  const { activeBranchId } = useBranch();
  const { add, itemCount } = useRequest();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);

  const clientType = profile?.client_type ?? 'regular';
  const isCostPerTest = clientType === 'cost_per_test';

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Cost Per Test clients can see all active products (no price needed)
      // Regular/KSO only see priced products
      const onlyPriced = !isCostPerTest;
      const { data } = await productsDb.getAll({ onlyPriced, branchId: activeBranchId });
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product catalog');
    } finally {
      setIsLoading(false);
    }
  }, [isCostPerTest, activeBranchId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddToCart = useCallback((product: Product) => {
    // Block adding to cart if profile is not completed
    if (profile && !profile.profile_completed) {
      router.push('/dashboard/profile');
      return;
    }
    add(product.id, product.name);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1200);
  }, [add, profile, router]);

  const getPrice = useCallback((product: Product): number | null => {
    if (isCostPerTest) return null; // Cost Per Test clients don't see prices
    if (!product.price) return null;
    return clientType === 'kso' ? product.price.price_kso : product.price.price_regular;
  }, [clientType, isCostPerTest]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  if (authLoading) return <PageSpinner />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse Products</h1>
          <p className="text-gray-500 text-sm mt-1">
            Select items to add to your request.
            {clientType === 'kso' && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                KSO Pricing
              </span>
            )}
            {isCostPerTest && (
              <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                Cost Per Test
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => router.push('/request')}
          className="relative inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-gray-800 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          View Cart
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, category, SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProducts} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title={search ? 'No products match your search' : 'No products available'}
          description={search ? `Try a different search term.` : 'Products will appear here once they are priced and active.'}
        />
      ) : (
        <>
          {/* Results count */}
          <p className="text-xs font-medium text-gray-500">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
            {search && ` for "${search}"`}
          </p>

          {/* Product Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map(product => {
              const price = getPrice(product);
              const isAdded = addedId === product.id;

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all hover:border-gray-200 hover:shadow-md"
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-gray-50">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                    )}
                    {product.category && (
                      <span className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-700 backdrop-blur-sm">
                        {product.category}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-auto pt-3">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          {isCostPerTest ? (
                            <p className="text-xs font-medium text-purple-600">
                              Cost Per Test
                            </p>
                          ) : (
                            <>
                              <p className="text-lg font-bold text-gray-900">
                                {price !== null ? formatCurrency(price) : '-'}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                per {product.unit}
                              </p>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={!isCostPerTest && price === null}
                          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                            isAdded
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-900 text-white hover:bg-gray-800'
                          }`}
                        >
                          {isAdded ? 'Added!' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
