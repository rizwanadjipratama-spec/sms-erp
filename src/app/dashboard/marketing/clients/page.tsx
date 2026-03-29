'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { profilesDb, requestsDb } from '@/lib/db';
import { formatCurrency, formatRelative } from '@/lib/format-utils';
import { PageSpinner, EmptyState, ErrorState, StatCard } from '@/components/ui';
import type { Profile, DbRequest } from '@/types/types';

export default function MarketingClientsPage() {
  const { profile } = useAuth();

  const [clients, setClients] = useState<Profile[]>([]);
  const [allMarketers, setAllMarketers] = useState<Profile[]>([]);
  const [clientOrders, setClientOrders] = useState<Record<string, DbRequest[]>>({});
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'my' | 'unassigned' | 'all'>('my');

  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const [clientResult, marketers] = await Promise.all([
        profilesDb.getByRole('client'),
        profilesDb.getByRole('marketing'),
      ]);
      setClients(clientResult);
      setAllMarketers(marketers);

      // Fetch recent orders for all clients in parallel (batch)
      const orderMap: Record<string, DbRequest[]> = {};
      const orderResult = await requestsDb.getAll();
      for (const order of orderResult.data) {
        if (!orderMap[order.user_id]) orderMap[order.user_id] = [];
        orderMap[order.user_id].push(order);
      }
      setClientOrders(orderMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  const handleAssign = useCallback(async (clientId: string, marketerId: string | null) => {
    setSavingId(clientId);
    try {
      await profilesDb.update(clientId, {
        handled_by: marketerId || undefined,
      } as Partial<Profile>);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign client');
    } finally {
      setSavingId(null);
    }
  }, [refresh]);

  const handleClaimClient = useCallback(async (clientId: string) => {
    if (!profile) return;
    await handleAssign(clientId, profile.id);
  }, [profile, handleAssign]);

  const filteredClients = useMemo(() => {
    let list = clients;

    // Filter by assignment
    if (filterMode === 'my') {
      list = list.filter(c => c.handled_by === profile?.id);
    } else if (filterMode === 'unassigned') {
      list = list.filter(c => !c.handled_by);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [clients, filterMode, search, profile]);

  const myClientCount = useMemo(
    () => clients.filter(c => c.handled_by === profile?.id).length,
    [clients, profile]
  );
  const unassignedCount = useMemo(
    () => clients.filter(c => !c.handled_by).length,
    [clients]
  );

  const getMarketerName = useCallback((id?: string) => {
    if (!id) return null;
    const m = allMarketers.find(p => p.id === id);
    return m?.name || m?.email || 'Unknown';
  }, [allMarketers]);

  const getClientRevenue = useCallback((clientId: string) => {
    const orders = clientOrders[clientId] || [];
    return orders
      .filter(o => !['cancelled', 'rejected'].includes(o.status))
      .reduce((sum, o) => sum + (o.total_price || 0), 0);
  }, [clientOrders]);

  const getClientOrderCount = useCallback((clientId: string) => {
    return (clientOrders[clientId] || []).length;
  }, [clientOrders]);

  if (fetching) return <PageSpinner />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-apple-text-primary tracking-tight">My Clients</h1>
        <p className="mt-1 text-sm text-apple-text-secondary">
          Manage and track clients assigned to you.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="My Clients" value={myClientCount} color="blue" />
        <StatCard label="Unassigned" value={unassignedCount} color={unassignedCount > 0 ? 'yellow' : 'green'} />
        <StatCard label="Total Clients" value={clients.length} color="gray" />
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex rounded-xl border border-apple-gray-border overflow-hidden text-xs font-bold">
          {(['my', 'unassigned', 'all'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2.5 transition-colors capitalize ${
                filterMode === mode
                  ? 'bg-apple-text-primary text-white'
                  : 'bg-white text-apple-text-secondary hover:bg-apple-gray-bg'
              }`}
            >
              {mode === 'my' ? 'My Clients' : mode === 'unassigned' ? 'Unassigned' : 'All'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-apple-gray-border bg-apple-gray-bg py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
          />
        </div>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <EmptyState
          title={search ? 'No clients match your search' : filterMode === 'my' ? 'No clients assigned to you yet' : 'No unassigned clients'}
          description={filterMode === 'unassigned' ? 'All clients have been assigned.' : 'Switch to "Unassigned" tab to claim clients.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredClients.map(client => {
            const orderCount = getClientOrderCount(client.id);
            const revenue = getClientRevenue(client.id);
            const isMyClient = client.handled_by === profile?.id;
            const handlerName = getMarketerName(client.handled_by);

            return (
              <div
                key={client.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                  isMyClient ? 'border-apple-blue/20' : 'border-apple-gray-border'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Client Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-apple-blue/10 text-xs font-bold text-apple-blue shrink-0">
                        {(client.name ?? client.email)[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-apple-text-primary truncate">
                          {client.name || client.email}
                        </p>
                        <p className="text-xs text-apple-text-secondary truncate">
                          {client.company || client.email}
                          {client.phone && ` · ${client.phone}`}
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
                      {client.client_type && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          client.client_type === 'kso'
                            ? 'bg-blue-50 text-blue-700'
                            : client.client_type === 'cost_per_test'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {client.client_type === 'cost_per_test' ? 'Cost/Test' : client.client_type}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {orderCount} order{orderCount !== 1 ? 's' : ''}
                      </span>
                      {revenue > 0 && (
                        <span className="inline-flex items-center rounded-full bg-apple-success/10 px-2 py-0.5 text-[10px] font-bold text-apple-success">
                          {formatCurrency(revenue)}
                        </span>
                      )}
                      {client.last_login && (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-apple-text-secondary">
                          Last login {formatRelative(client.last_login)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assignment Control */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isMyClient ? (
                      <span className="text-xs font-bold text-apple-blue bg-apple-blue/10 px-3 py-1.5 rounded-lg">
                        Assigned to you
                      </span>
                    ) : client.handled_by ? (
                      <span className="text-xs font-medium text-apple-text-secondary bg-apple-gray-bg px-3 py-1.5 rounded-lg">
                        Handled by {handlerName}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleClaimClient(client.id)}
                        disabled={savingId === client.id}
                        className="text-xs font-bold text-white bg-apple-blue hover:bg-apple-blue-hover px-4 py-2 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
                      >
                        {savingId === client.id ? 'Claiming...' : 'Claim Client'}
                      </button>
                    )}

                    {/* Reassign dropdown for own clients */}
                    {isMyClient && (
                      <button
                        onClick={() => {
                          if (confirm('Remove yourself from this client?')) {
                            handleAssign(client.id, null);
                          }
                        }}
                        disabled={savingId === client.id}
                        className="text-xs font-medium text-apple-text-secondary hover:text-apple-danger bg-apple-gray-bg hover:bg-apple-danger/10 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Release
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
