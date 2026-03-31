'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { purchaseRequestsDb, purchaseOrdersDb, suppliersDb } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { PurchaseRequest, PurchaseOrder, Supplier } from '@/types/types';

type TabKey = 'requests' | 'orders' | 'suppliers';

export default function PurchasingDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [prs, setPrs] = useState<PurchaseRequest[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tab, setTab] = useState<TabKey>('requests');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/purchasing')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const branchId = (profile as any).branch_id;
      const [prData, poData, suppData] = await Promise.all([
        purchaseRequestsDb.getAll(branchId),
        purchaseOrdersDb.getAll(branchId),
        suppliersDb.getAll(),
      ]);
      setPrs(prData);
      setPos(poData);
      setSuppliers(suppData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchasing data');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => { if (profile) refreshAll(); }, [profile, refreshAll]);

  const visiblePrs = useMemo(() => prs.filter(p => !['draft', 'submitted', 'rejected'].includes(p.status)), [prs]);

  const stats = useMemo(() => ({
    totalPRs: visiblePrs.length,
    pendingPRs: visiblePrs.filter(p => p.status === 'approved').length,
    totalPOs: pos.length,
    openPOs: pos.filter(p => !['received', 'cancelled'].includes(p.status)).length,
    totalSuppliers: suppliers.length,
    totalSpend: pos.filter(p => p.status !== 'cancelled').reduce((s, p) => s + Number(p.total), 0),
  }), [prs, pos, suppliers]);

  if (loading || fetching) {
    return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><DashboardSkeleton /></div>;
  }
  if (error) {
    return <div className="mx-auto max-w-6xl p-4 sm:p-6"><ErrorState message={error} onRetry={refreshAll} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Purchasing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage purchase requests, orders, and suppliers.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Purchase Requests" value={stats.totalPRs} color="blue" />
        <StatCard label="Ready to Order" value={stats.pendingPRs} color="yellow" />
        <StatCard label="Active POs" value={stats.openPOs} color="purple" />
        <StatCard label="Total Spend" value={formatCurrency(stats.totalSpend)} color="green" />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([
          { key: 'requests' as TabKey, label: `Requests (${visiblePrs.length})` },
          { key: 'orders' as TabKey, label: `Orders (${pos.length})` },
          { key: 'suppliers' as TabKey, label: `Suppliers (${suppliers.length})` },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
              tab === item.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <section className="space-y-3">
          {visiblePrs.length === 0 ? (
            <EmptyState title="No purchase requests" description="No approved purchase requests are available." />
          ) : (
            visiblePrs.map(pr => (
              <div key={pr.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{pr.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{formatDate(pr.created_at)}</p>
                    {pr.notes && <p className="mt-1 text-sm text-gray-500">{pr.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pr.status} />
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(pr.total_estimated)}</span>
                  </div>
                </div>
                {pr.items && pr.items.length > 0 && (
                  <div className="mt-3 border-t border-gray-50 pt-3 space-y-1">
                    {pr.items.map((item, i) => (
                      <p key={`${pr.id}-item-${i}`} className="text-xs text-gray-500">
                        {item.item_name} × {item.quantity} {item.unit} — {formatCurrency(item.estimated_price)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'orders' && (
        <section className="space-y-3">
          {pos.length === 0 ? (
            <EmptyState title="No purchase orders" description="No purchase orders have been created yet." />
          ) : (
            pos.map(po => (
              <div key={po.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{po.po_number}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDate(po.created_at)}
                    {po.supplier && <> · {(po.supplier as any).name}</>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={po.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(po.total)}</span>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'suppliers' && (
        <section className="space-y-3">
          {suppliers.length === 0 ? (
            <EmptyState title="No suppliers" description="Add suppliers to start creating purchase orders." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suppliers.map(s => (
                <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="font-medium text-gray-900">{s.name}</p>
                  {s.contact && <p className="text-xs text-gray-500 mt-1">{s.contact}</p>}
                  {s.phone && <p className="text-xs text-gray-500">{s.phone}</p>}
                  {s.email && <p className="text-xs text-blue-600">{s.email}</p>}
                  {s.address && <p className="text-xs text-gray-400 mt-1">{s.address}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
