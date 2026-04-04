'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { profilesDb } from '@/lib/db';
import { formatCurrency } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState } from '@/components/ui';
import type { Profile, UserRole } from '@/types/types';
import { supabase } from '@/lib/db/client';
import { FEATURE_DEFINITIONS, DEFAULT_FEATURES_BY_ROLE } from '@/lib/features';
import type { AppFeature } from '@/lib/features';

const ALL_ROLES: UserRole[] = ['client', 'marketing', 'boss', 'finance', 'warehouse', 'technician', 'admin', 'owner', 'tax', 'director', 'manager', 'purchasing', 'claim_officer', 'faktur'];
const PAGE_SIZE = 25;

export default function UsersManagementPage() {
  const { profile, loading } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [usersLimit, setUsersLimit] = useState(PAGE_SIZE);
  const [viewType, setViewType] = useState<'internal' | 'client'>('internal');
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFeatureUserId, setExpandedFeatureUserId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ userId: string; dragIdx: number; overIdx: number } | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/users')) {
      router.replace('/dashboard');
    }
  }, [loading, profile, router]);

  // ---------- Data fetching ----------
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);

    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeBranchId !== 'ALL') {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setFetching(false);
    }
  }, [profile, activeBranchId]);

  useEffect(() => {
    if (!profile) return;
    void refresh();
  }, [profile, refresh, activeBranchId]);

  // ---------- Realtime subscriptions ----------
  useRealtimeTable('profiles', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 300,
  });

  // ---------- Handlers ----------
  const handleUpdateRole = useCallback(async (userId: string, email: string, newRole: UserRole) => {
    setSaving(email);
    try {
      await profilesDb.update(userId, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSaving(null);
    }
  }, []);

  const handleUpdateBranch = useCallback(async (userId: string, email: string, newBranchId: string) => {
    setSaving(email);
    try {
      const isUnassigned = newBranchId === 'unassigned';
      await profilesDb.update(userId, { 
        branch_id: isUnassigned ? null : newBranchId,
        is_branch_pinned: !isUnassigned,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { 
          ...u, 
          branch_id: isUnassigned ? null : newBranchId,
          is_branch_pinned: !isUnassigned,
        } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update branch');
    } finally {
      setSaving(null);
    }
  }, []);

  const handleUpdateClientType = useCallback(async (userId: string, email: string, clientType: string) => {
    setSaving(email);
    try {
      await profilesDb.update(userId, { client_type: clientType as 'regular' | 'kso' });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, client_type: clientType as 'regular' | 'kso' } : u
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update client type');
    } finally {
      setSaving(null);
    }
  }, []);

  // ---------- Feature toggle ----------
  const handleToggleFeature = useCallback(async (userId: string, feature: AppFeature, currentFeatures: AppFeature[]) => {
    const has = currentFeatures.includes(feature);
    const updated = has ? currentFeatures.filter(f => f !== feature) : [...currentFeatures, feature];
    
    setSaving(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ features: updated })
        .eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, features: updated } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update features');
    } finally {
      setSaving(null);
    }
  }, []);

  const handleBulkToggle = useCallback(async (userId: string, features: AppFeature[], enable: boolean) => {
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return;
    const currentFeatures = currentUser.features || [];
    let updated: AppFeature[];
    if (enable) {
      updated = [...new Set([...currentFeatures, ...features])];
    } else {
      updated = currentFeatures.filter(f => !features.includes(f));
    }
    setSaving(userId);
    try {
      const { error } = await supabase.from('profiles').update({ features: updated }).eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, features: updated } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update features');
    } finally {
      setSaving(null);
    }
  }, [users]);

  const handleDragReorder = useCallback(async (userId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return;
    const features = [...(currentUser.features || [])] as AppFeature[];
    const [moved] = features.splice(fromIdx, 1);
    features.splice(toIdx, 0, moved);
    
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, features } : u));
    try {
      const { error } = await supabase.from('profiles').update({ features }).eq('id', userId);
      if (error) throw error;
    } catch (err) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, features: currentUser.features } : u));
      alert(err instanceof Error ? err.message : 'Failed to reorder');
    }
  }, [users]);

  // ---------- Computed ----------
  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.name || '').toLowerCase().includes(search.toLowerCase());
        const matchesType = viewType === 'client' ? u.role === 'client' : u.role !== 'client';
        return matchesSearch && matchesType;
      }),
    [users, search, viewType]
  );

  const displayedUsers = useMemo(
    () => filteredUsers.slice(0, usersLimit),
    [filteredUsers, usersLimit]
  );

  // ---------- Loading ----------
  if (loading || (fetching && !users.length)) {
    return (
      <div className="mx-auto max-w-6xl">
        <DashboardSkeleton />
      </div>
    );
  }

  // ---------- Error ----------
  if (error && !users.length) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users, assign roles, and distribute branch access.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        {/* Toggle Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => { setViewType('internal'); setUsersLimit(PAGE_SIZE); }}
            className={`pb-3 border-b-2 font-bold text-sm px-2 transition-colors ${
              viewType === 'internal'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Internal Staff
          </button>
          <button
            onClick={() => { setViewType('client'); setUsersLimit(PAGE_SIZE); }}
            className={`pb-3 border-b-2 font-bold text-sm px-2 transition-colors ${
              viewType === 'client'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Clients
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            Total {viewType === 'client' ? 'Clients' : 'Staff'} ({filteredUsers.length})
          </h2>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setUsersLimit(PAGE_SIZE); }}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-80 shadow-sm"
          />
        </div>

        {displayedUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            description={search ? 'Try a different search term.' : 'No users registered yet.'}
          />
        ) : (
          <div className="space-y-3">
            {displayedUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {user.name || '(no name)'} 
                      {!user.is_active && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] uppercase text-red-600 font-bold">Unmapped / Inactive</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Role Tag Dropdown */}
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Role</span>
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, user.email, e.target.value as UserRole)}
                        disabled={saving === user.email}
                        className="rounded bg-transparent py-1 text-xs font-bold text-[var(--apple-blue)] outline-none hover:text-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    {/* Branch Tag Dropdown */}
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Branch</span>
                      <select
                        value={user.branch_id || 'unassigned'}
                        onChange={(e) => handleUpdateBranch(user.id, user.email, e.target.value)}
                        disabled={saving === user.email}
                        className="rounded bg-transparent py-1 text-xs font-bold text-emerald-600 outline-none hover:text-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        <option value="unassigned">No Branch</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {user.role === 'client' && (
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Type</span>
                        <select
                          value={user.client_type || 'regular'}
                          onChange={(e) => handleUpdateClientType(user.id, user.email, e.target.value)}
                          disabled={saving === user.email}
                          className="rounded bg-transparent py-1 text-xs font-bold text-purple-600 outline-none hover:text-purple-700 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="regular">Regular</option>
                          <option value="kso">KSO</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-t border-gray-50 pt-3">
                  <span className="rounded-full bg-gray-100 flex items-center px-2.5 py-1">
                    Debt: <span className="text-gray-900 ml-1">{formatCurrency(user.debt_amount)}</span>
                  </span>
                  <span className="rounded-full bg-gray-100 flex items-center px-2.5 py-1">
                    Limit: <span className="text-gray-900 ml-1">{formatCurrency(user.debt_limit)}</span>
                  </span>
                  <span className="rounded-full bg-gray-100 flex items-center px-2.5 py-1">
                    Phone: <span className="text-gray-900 ml-1 capitalize">{user.phone || 'N/A'}</span>
                  </span>
                  <button
                    onClick={() => setExpandedFeatureUserId(prev => prev === user.id ? null : user.id)}
                    className="ml-auto rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:bg-blue-100 transition-colors normal-case"
                  >
                    {expandedFeatureUserId === user.id ? '▲ Tutup Fitur' : '⚙️ Kelola Fitur Sidebar'}
                  </button>
                </div>

                {/* Feature Management Panel */}
                {expandedFeatureUserId === user.id && (() => {
                  const rawFeatures = (user.features || []) as AppFeature[];
                  const userFeatures = rawFeatures.length > 0 ? rawFeatures : (DEFAULT_FEATURES_BY_ROLE[user.role] || []);
                  const featureLookup = new Map(FEATURE_DEFINITIONS.map(f => [f.id, f]));
                  return (
                  <div className="mt-4 border-t border-gray-100 pt-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Fitur Sidebar yang Diizinkan</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBulkToggle(user.id, FEATURE_DEFINITIONS.filter(f => !f.clientOnly).map(f => f.id), true)}
                          disabled={saving === user.id}
                          className="text-[10px] font-bold text-green-600 hover:underline disabled:opacity-50"
                        >Centang Semua</button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={async () => {
                            const defaults = DEFAULT_FEATURES_BY_ROLE[user.role] || [];
                            setSaving(user.id);
                            try {
                              const { error } = await supabase.from('profiles').update({ features: defaults }).eq('id', user.id);
                              if (error) throw error;
                              setUsers(prev => prev.map(u => u.id === user.id ? { ...u, features: defaults } : u));
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Failed to reset features');
                            } finally {
                              setSaving(null);
                            }
                          }}
                          disabled={saving === user.id}
                          className="text-[10px] font-bold text-red-500 hover:underline disabled:opacity-50"
                        >Reset ke Default</button>
                      </div>
                    </div>

                    {/* Checkbox grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {FEATURE_DEFINITIONS.filter(f => !f.clientOnly).map(feat => {
                        const isActive = userFeatures.includes(feat.id);
                        return (
                          <label
                            key={feat.id}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all text-xs font-medium ${
                              isActive
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                            } ${saving === user.id ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={() => handleToggleFeature(user.id, feat.id, userFeatures)}
                              disabled={saving === user.id}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span className="text-sm">{feat.icon}</span>
                            <span className="truncate">{feat.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Ordered active list — drag to reorder */}
                    {userFeatures.length > 0 && (
                      <div className="mt-5 border-t border-gray-100 pt-4">
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3">📋 Urutan Sidebar (Drag untuk pindahkan)</h4>
                        <div className="space-y-1 max-h-80 overflow-y-auto">
                          {userFeatures.map((fId, idx) => {
                            const def = featureLookup.get(fId);
                            if (!def) return null;
                            const isDragging = dragState?.userId === user.id && dragState.dragIdx === idx;
                            const isDragOver = dragState?.userId === user.id && dragState.overIdx === idx && dragState.dragIdx !== idx;
                            return (
                              <div
                                key={fId}
                                draggable
                                onDragStart={(e) => {
                                  setDragState({ userId: user.id, dragIdx: idx, overIdx: idx });
                                  e.dataTransfer.effectAllowed = 'move';
                                  // Make the drag image slightly transparent
                                  if (e.currentTarget instanceof HTMLElement) {
                                    e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
                                  }
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (dragState && dragState.userId === user.id) {
                                    setDragState(prev => prev ? { ...prev, overIdx: idx } : null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (dragState && dragState.userId === user.id) {
                                    handleDragReorder(user.id, dragState.dragIdx, idx);
                                  }
                                  setDragState(null);
                                }}
                                onDragEnd={() => setDragState(null)}
                                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all select-none ${
                                  isDragging
                                    ? 'opacity-40 bg-gray-100 border border-dashed border-gray-300'
                                    : isDragOver
                                    ? 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                {/* Drag handle */}
                                <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0" title="Drag untuk pindahkan">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                                    <circle cx="9" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" />
                                    <circle cx="9" cy="15" r="1.5" /><circle cx="15" cy="15" r="1.5" />
                                    <circle cx="9" cy="20" r="1.5" /><circle cx="15" cy="20" r="1.5" />
                                  </svg>
                                </span>
                                <span className="text-[10px] font-black text-gray-300 w-5 text-center">{idx + 1}</span>
                                <span className="text-sm">{def.icon}</span>
                                <span className="flex-1 text-xs font-semibold text-gray-800 truncate">{def.label}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[10px] text-gray-400 italic">Seret ⠿ handle di kiri untuk mengubah urutan sidebar user.</p>
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>
            ))}

            {filteredUsers.length > usersLimit && (
              <button
                onClick={() => setUsersLimit((prev) => prev + PAGE_SIZE)}
                className="w-full mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-[var(--apple-blue)] shadow-sm"
              >
                Load More Users ↓
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
