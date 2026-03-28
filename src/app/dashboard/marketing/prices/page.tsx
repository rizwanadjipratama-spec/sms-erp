'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { productService } from '@/lib/services';
import { productsDb, priceListDb } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/format-utils';
import { PageSpinner, EmptyState, ErrorState, StatCard } from '@/components/ui';
import type { Product, PriceList } from '@/types/types';

export default function PriceListPage() {
  const { profile, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceList[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ product_id: '', price_regular: '', price_kso: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [productResult, priceList] = await Promise.all([
        productsDb.getAll(),
        priceListDb.getAll(),
      ]);
      setProducts(productResult.data);
      setPrices(priceList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && profile) {
      fetchData();
    }
  }, [authLoading, profile, fetchData]);

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.price_regular || !form.price_kso) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const actor = profile ? { id: profile.id, email: profile.email, role: profile.role } : undefined;
      await productService.setPrice(
        form.product_id,
        Number(form.price_regular),
        Number(form.price_kso),
        actor
      );
      setForm({ product_id: '', price_regular: '', price_kso: '' });
      setEditingId(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchData();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save price');
    } finally {
      setSaving(false);
    }
  }, [form, profile, fetchData]);

  const handleEdit = useCallback((price: PriceList) => {
    setForm({
      product_id: price.product_id,
      price_regular: String(price.price_regular),
      price_kso: String(price.price_kso),
    });
    setEditingId(price.product_id);
    setSaveError(null);
    setSaveSuccess(false);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setForm({ product_id: '', price_regular: '', price_kso: '' });
    setEditingId(null);
    setSaveError(null);
  }, []);

  const priceMap = useMemo(() => {
    return new Map(prices.map(p => [p.product_id, p]));
  }, [prices]);

  const productsWithoutPrice = useMemo(() => {
    return products.filter(p => !priceMap.has(p.id));
  }, [products, priceMap]);

  const filteredPrices = useMemo(() => {
    if (!search.trim()) return prices;
    const q = search.toLowerCase();
    return prices.filter(price => {
      const product = products.find(p => p.id === price.product_id);
      return product?.name.toLowerCase().includes(q) ||
        product?.sku?.toLowerCase().includes(q);
    });
  }, [prices, search, products]);

  const getProductName = useCallback((productId: string): string => {
    return products.find(p => p.id === productId)?.name ?? productId;
  }, [products]);

  if (authLoading || fetching) return <PageSpinner />;

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price List</h1>
        <p className="mt-1 text-sm text-gray-500">Manage Regular and KSO pricing per product</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Products Priced"
          value={prices.length}
          sub={`of ${products.length} total products`}
          color="green"
        />
        <StatCard
          label="Without Price"
          value={productsWithoutPrice.length}
          sub={productsWithoutPrice.length > 0 ? 'Needs attention' : 'All set'}
          color={productsWithoutPrice.length > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          label="Total Products"
          value={products.length}
          sub="Active in catalog"
          color="blue"
        />
      </div>

      {/* Price Form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {editingId ? 'Update Price' : 'Add / Update Price'}
          </h2>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {saveError && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-700">
            Price saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-4">
          <select
            value={form.product_id}
            onChange={e => setForm(prev => ({ ...prev, product_id: e.target.value }))}
            disabled={!!editingId}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:bg-white disabled:opacity-60 sm:col-span-2"
            required
          >
            <option value="">Select product...</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name}
                {!priceMap.has(product.id) ? ' (no price)' : ''}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Price Regular (Rp)"
            value={form.price_regular}
            onChange={e => setForm(prev => ({ ...prev, price_regular: e.target.value }))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:bg-white"
            required
            min="0"
          />
          <input
            type="number"
            placeholder="Price KSO (Rp)"
            value={form.price_kso}
            onChange={e => setForm(prev => ({ ...prev, price_kso: e.target.value }))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:bg-white"
            required
            min="0"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 sm:col-span-4"
          >
            {saving ? 'Saving...' : editingId ? 'Update Price' : 'Save Price'}
          </button>
        </form>
      </div>

      {/* Warning: Products without price */}
      {productsWithoutPrice.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            {productsWithoutPrice.length} product{productsWithoutPrice.length !== 1 ? 's' : ''} without a price
          </p>
          <p className="mt-1 text-xs text-amber-600">
            {productsWithoutPrice.map(p => p.name).join(', ')}
          </p>
        </div>
      )}

      {/* Price Table */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Current Prices ({prices.length} product{prices.length !== 1 ? 's' : ''})
          </h2>
          {prices.length > 0 && (
            <div className="relative max-w-xs">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search prices..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white"
              />
            </div>
          )}
        </div>

        {filteredPrices.length === 0 ? (
          <EmptyState
            title={search ? 'No prices match your search' : 'No prices configured'}
            description={search ? 'Try a different search term.' : 'Use the form above to set prices for products.'}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Regular</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">KSO</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Updated</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrices.map(price => (
                    <tr
                      key={price.id}
                      className={`border-b border-gray-50 transition-colors hover:bg-gray-50/50 ${
                        editingId === price.product_id ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {getProductName(price.product_id)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(price.price_regular)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(price.price_kso)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {formatDate(price.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(price)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-50 sm:hidden">
              {filteredPrices.map(price => (
                <div
                  key={price.id}
                  className={`p-4 ${editingId === price.product_id ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {getProductName(price.product_id)}
                    </p>
                    <button
                      onClick={() => handleEdit(price)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-500">
                    <span>Regular: <strong className="text-gray-900">{formatCurrency(price.price_regular)}</strong></span>
                    <span>KSO: <strong className="text-gray-900">{formatCurrency(price.price_kso)}</strong></span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">Updated {formatDate(price.updated_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
