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

const ALL_ROLES: UserRole[] = ['client', 'marketing', 'boss', 'finance', 'warehouse', 'technician', 'admin', 'owner', 'tax', 'director', 'manager', 'purchasing', 'claim_officer', 'faktur'];
const PAGE_SIZE = 25;

export default function UsersManagementPage() {
  const { profile, loading } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [usersLimit, setUsersLimit] = useState(PAGE_SIZE);
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Auth guard ----------
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/users')) {
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
      await profilesDb.update(userId, { branch_id: newBranchId === 'unassigned' ? null : newBranchId });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, branch_id: newBranchId === 'unassigned' ? null : newBranchId } : u))
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

  // ---------- Computed ----------
  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.name || '').toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            Total Users ({filteredUsers.length})
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
                      {user.status === 'banned' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] uppercase text-red-600 font-bold">Banned</span>}
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

                <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-t border-gray-50 pt-3">
                  <span className="rounded-full bg-gray-100 flex items-center px-2.5 py-1">
                    Debt: <span className="text-gray-900 ml-1">{formatCurrency(user.debt_amount)}</span>
                  </span>
                  <span className="rounded-full bg-gray-100 flex items-center px-2.5 py-1">
                    Limit: <span className="text-gray-900 ml-1">{formatCurrency(user.debt_limit)}</span>
                  </span>
                  <span className="rounded-full bg-gray-100 flex items-center px-2.5 py-1">
                    Phone: <span className="text-gray-900 ml-1 capitalize">{user.phone || 'N/A'}</span>
                  </span>
                </div>
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
