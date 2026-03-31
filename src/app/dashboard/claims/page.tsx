'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { expenseClaimsDb, cashAdvancesDb, claimLedgerDb } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { ExpenseClaim, CashAdvance, ClaimLedger } from '@/types/types';

type TabKey = 'claims' | 'advances' | 'ledger';

const CATEGORY_LABELS: Record<string, string> = {
  fuel: '⛽ Fuel',
  toll: '🛣️ Toll',
  parking: '🅿️ Parking',
  small_tools: '🔧 Small Tools',
  sparepart: '⚙️ Sparepart',
  hotel: '🏨 Hotel',
  meals: '🍽️ Meals',
  vehicle_service: '🚗 Vehicle',
  operational: '📋 Operational',
  other: '📎 Other',
};

export default function ClaimsDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [ledger, setLedger] = useState<ClaimLedger[]>([]);
  const [tab, setTab] = useState<TabKey>('claims');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/claims')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refreshAll = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const branchId = (profile as any).branch_id;
      const isGlobal = ['owner', 'admin'].includes(profile.role);
      const [claimsData, advancesData, ledgerData] = await Promise.all([
        expenseClaimsDb.getAll(isGlobal ? undefined : branchId),
        cashAdvancesDb.getByUser(profile.id),
        claimLedgerDb.getByUser(profile.id),
      ]);
      setClaims(claimsData);
      setAdvances(advancesData);
      setLedger(ledgerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims data');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => { if (profile) refreshAll(); }, [profile, refreshAll]);

  const stats = useMemo(() => ({
    totalClaims: claims.length,
    pendingClaims: claims.filter(c => ['submitted', 'approved'].includes(c.status)).length,
    totalAmount: claims.reduce((s, c) => s + Number(c.amount), 0),
    paidAmount: claims.reduce((s, c) => s + Number(c.paid_amount), 0),
    activeAdvances: advances.filter(a => !['settled', 'cancelled', 'rejected'].includes(a.status)).length,
  }), [claims, advances]);

  if (loading || fetching) {
    return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><DashboardSkeleton /></div>;
  }
  if (error) {
    return <div className="mx-auto max-w-6xl p-4 sm:p-6"><ErrorState message={error} onRetry={refreshAll} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Expense Claims</h1>
        <p className="mt-1 text-sm text-gray-500">Submit and track expense claims, cash advances, and monthly ledger.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Claims" value={stats.totalClaims} color="blue" />
        <StatCard label="Pending" value={stats.pendingClaims} color="yellow" />
        <StatCard label="Claimed" value={formatCurrency(stats.totalAmount)} color="purple" />
        <StatCard label="Paid" value={formatCurrency(stats.paidAmount)} color="green" />
        <StatCard label="Active Advances" value={stats.activeAdvances} color="red" />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([
          { key: 'claims' as TabKey, label: `Claims (${claims.length})` },
          { key: 'advances' as TabKey, label: `Advances (${advances.length})` },
          { key: 'ledger' as TabKey, label: `Ledger (${ledger.length})` },
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

      {tab === 'claims' && (
        <section className="space-y-3">
          {claims.length === 0 ? (
            <EmptyState title="No expense claims" description="Submit your first expense claim to get started." />
          ) : (
            claims.map(c => (
              <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[c.category] || c.category}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="font-medium text-gray-900 mt-1">{c.title}</p>
                    {c.description && <p className="mt-0.5 text-sm text-gray-500">{c.description}</p>}
                    <p className="mt-1 text-xs text-gray-400">
                      {c.claimant ? `${(c.claimant as any).name} · ` : ''}{formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(c.amount)}</p>
                    {c.paid_amount > 0 && (
                      <p className="text-xs text-green-600">Paid: {formatCurrency(c.paid_amount)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'advances' && (
        <section className="space-y-3">
          {advances.length === 0 ? (
            <EmptyState title="No cash advances" description="No cash advance requests found." />
          ) : (
            advances.map(a => (
              <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{a.purpose}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatDate(a.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={a.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(a.amount)}</span>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'ledger' && (
        <section className="space-y-3">
          {ledger.length === 0 ? (
            <EmptyState title="No ledger entries" description="Your monthly claim ledger will appear here." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ledger.map(l => (
                <div key={l.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{String(l.month).padStart(2, '0')}/{l.year}</p>
                    {l.is_closed ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Closed</span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Open</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Claimed</span><span className="font-medium">{formatCurrency(l.total_claimed)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-medium text-green-600">{formatCurrency(l.total_paid)}</span></div>
                    <div className="flex justify-between border-t border-gray-50 pt-1"><span className="text-gray-500">Remaining</span><span className="font-semibold text-blue-600">{formatCurrency(l.remaining)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
