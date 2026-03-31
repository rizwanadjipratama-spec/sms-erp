'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { productBranchStockDb, branchesDb } from '@/lib/db';
import { formatNumber } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { ProductBranchStock, Branch } from '@/types/types';

export default function StockDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [stock, setStock] = useState<ProductBranchStock[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/stock')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Load branches
  useEffect(() => {
    (async () => {
      try {
        const b = await branchesDb.getAll();
        setBranches(b);
        const userBranchId = (profile as any)?.branch_id;
        if (userBranchId) setSelectedBranch(userBranchId);
        else if (b.length > 0) setSelectedBranch(b[0].id);
      } catch {}
    })();
  }, [profile]);

  const refreshStock = useCallback(async () => {
    if (!selectedBranch) return;
    setFetching(true);
    setError(null);
    try {
      const data = await productBranchStockDb.getByBranch(selectedBranch);
      setStock(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
    } finally {
      setFetching(false);
    }
  }, [selectedBranch]);

  useEffect(() => { if (selectedBranch) refreshStock(); }, [selectedBranch, refreshStock]);

  const stats = useMemo(() => {
    const lowStock = stock.filter(s => s.stock <= s.min_stock);
    const outOfStock = stock.filter(s => s.stock === 0);
    const totalItems = stock.reduce((s, item) => s + item.stock, 0);
    return {
      totalProducts: stock.length,
      totalItems,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    };
  }, [stock]);

  if (loading) {
    return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><DashboardSkeleton /></div>;
  }
  if (error) {
    return <div className="mx-auto max-w-6xl p-4 sm:p-6"><ErrorState message={error} onRetry={refreshStock} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Branch Stock</h1>
          <p className="mt-1 text-sm text-gray-500">Per-branch inventory levels and low stock alerts.</p>
        </div>
        <select
          value={selectedBranch}
          onChange={e => setSelectedBranch(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products" value={stats.totalProducts} color="blue" />
        <StatCard label="Total Items" value={formatNumber(stats.totalItems)} color="green" />
        <StatCard label="Low Stock" value={stats.lowStockCount} color="yellow" />
        <StatCard label="Out of Stock" value={stats.outOfStockCount} color="red" />
      </div>

      {fetching ? (
        <DashboardSkeleton />
      ) : stock.length === 0 ? (
        <EmptyState title="No stock data" description="No products have been assigned to this branch yet." />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left font-medium text-gray-500 px-4 py-3">Product</th>
                <th className="text-right font-medium text-gray-500 px-4 py-3">Stock</th>
                <th className="text-right font-medium text-gray-500 px-4 py-3">Min</th>
                <th className="text-center font-medium text-gray-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stock.sort((a, b) => a.stock - b.stock).map(item => {
                const isLow = item.stock <= item.min_stock;
                const isOut = item.stock === 0;
                return (
                  <tr key={item.id} className={`${isOut ? 'bg-red-50/50' : isLow ? 'bg-yellow-50/50' : ''} transition-colors hover:bg-gray-50`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{(item.product as any)?.name || item.product_id}</p>
                      {(item.product as any)?.sku && (
                        <p className="text-xs text-gray-400">{(item.product as any).sku}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {formatNumber(item.stock)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatNumber(item.min_stock)}</td>
                    <td className="px-4 py-3 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">OUT</span>
                      ) : isLow ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">LOW</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
