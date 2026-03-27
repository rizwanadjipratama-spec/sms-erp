'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { getPriceList, upsertPriceList, deletePriceEntry } from '@/lib/prices';
import { formatCurrency } from '@/lib/format-utils';
import type { PriceList, Product } from '@/types/types';

export default function PriceListPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [prices, setPrices] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({ product_id: '', price_regular: '', price_kso: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/marketing/prices')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;

    const run = async () => {
      setFetching(true);
      const [priceList, productRes] = await Promise.all([
        getPriceList(),
        supabase.from('products').select('id, name').order('name'),
      ]);

      setPrices(priceList);
      setProducts((productRes.data || []) as Product[]);
      setFetching(false);
    };

    run();
  }, [profile]);

  const refresh = async () => {
    const [priceList, productRes] = await Promise.all([
      getPriceList(),
      supabase.from('products').select('id, name').order('name'),
    ]);

    setPrices(priceList);
    setProducts((productRes.data || []) as Product[]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.price_regular || !form.price_kso) return;
    setSaving(true);
    try {
      await upsertPriceList(form.product_id, Number(form.price_regular), Number(form.price_kso));
      setForm({ product_id: '', price_regular: '', price_kso: '' });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save price');
    }
    setSaving(false);
  };

  const deletePrice = async (id: string) => {
    if (!confirm('Remove this price entry?')) return;
    try {
      await deletePriceEntry(id);
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to remove price');
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const productWithPrice = new Set(prices.map((price) => price.product_id));
  const productsWithoutPrice = products.filter((product) => !productWithPrice.has(product.id));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price List</h1>
        <p className="text-gray-500 text-sm mt-1">Manage Regular and KSO pricing per product</p>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add / Update Price</h2>
        <form onSubmit={handleSave} className="grid sm:grid-cols-4 gap-3">
          <select
            value={form.product_id}
            onChange={(e) => setForm((prev) => ({ ...prev, product_id: e.target.value }))}
            className="sm:col-span-2 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-purple-500"
            required
          >
            <option value="">Select product...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} {!productWithPrice.has(product.id) && '(no price)'}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Price Regular (Rp)"
            value={form.price_regular}
            onChange={(e) => setForm((prev) => ({ ...prev, price_regular: e.target.value }))}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
            required
            min="0"
          />
          <input
            type="number"
            placeholder="Price KSO (Rp)"
            value={form.price_kso}
            onChange={(e) => setForm((prev) => ({ ...prev, price_kso: e.target.value }))}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
            required
            min="0"
          />
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Price'}
          </button>
        </form>
      </div>

      {productsWithoutPrice.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-amber-400 text-sm font-medium mb-1">
            {productsWithoutPrice.length} product(s) without a price
          </p>
          <p className="text-amber-300/70 text-xs">{productsWithoutPrice.map((product) => product.name).join(', ')}</p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Prices ({prices.length} products)</h2>
        {prices.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 text-center text-gray-500">
            No prices configured yet
          </div>
        ) : (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Product</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Regular</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">KSO</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {prices.map((price) => (
                  <tr key={price.id} className="border-b border-gray-200/50 hover:bg-gray-100/30 transition-colors">
                    <td className="px-4 py-3 text-gray-900">{price.product_name || price.product_id}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(price.price_regular)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(price.price_kso)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {new Date(price.updated_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deletePrice(price.id)} className="text-red-400 hover:text-red-300 text-xs">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
