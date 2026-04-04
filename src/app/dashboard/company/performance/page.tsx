'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { analyticsService, authService } from '@/lib/services';
import { formatNumber, formatRelative } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard } from '@/components/ui';

type PerfData = Awaited<ReturnType<typeof analyticsService.getEmployeePerformance>>;

const ROLE_COLORS: Record<string, string> = {
  marketing: 'bg-blue-50 text-blue-700',
  boss: 'bg-purple-50 text-purple-700',
  finance: 'bg-green-50 text-green-700',
  warehouse: 'bg-yellow-50 text-yellow-700',
  technician: 'bg-orange-50 text-orange-700',
  courier: 'bg-cyan-50 text-cyan-700',
  admin: 'bg-red-50 text-red-700',
  owner: 'bg-indigo-50 text-indigo-700',
  tax: 'bg-gray-100 text-gray-700',
  faktur: 'bg-pink-50 text-pink-700',
};

export default function EmployeePerformancePage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PerfData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'actions' | 'logins' | 'deliveries' | 'name'>('actions');

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/company')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const result = await analyticsService.getEmployeePerformance();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    let list = data.employees;
    if (filterRole !== 'all') {
      list = list.filter(e => e.role === filterRole);
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'actions': return b.totalActions - a.totalActions;
        case 'logins': return b.totalLogins - a.totalLogins;
        case 'deliveries': return b.deliveries - a.deliveries;
        case 'name': return (a.name || '').localeCompare(b.name || '');
        default: return 0;
      }
    });
  }, [data, filterRole, sortBy]);

  const availableRoles = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.employees.map(e => e.role))].sort();
  }, [data]);

  // Top performer
  const topPerformer = useMemo(() => {
    if (!data || data.employees.length === 0) return null;
    return data.employees.reduce((best, emp) => emp.totalActions > best.totalActions ? emp : best, data.employees[0]);
  }, [data]);

  if (loading || (fetching && !data)) {
    return <div className="max-w-6xl mx-auto p-4"><DashboardSkeleton /></div>;
  }

  if (error && !data) {
    return <div className="max-w-6xl mx-auto p-4"><ErrorState message={error} onRetry={refresh} /></div>;
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard/company" className="text-[var(--apple-blue)] hover:underline text-sm font-medium">
              Company
            </Link>
            <span className="text-[var(--apple-text-tertiary)]">/</span>
            <span className="text-sm font-bold text-[var(--apple-text-primary)]">Performance</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--apple-text-primary)] tracking-tight">
            Employee Performance
          </h1>
          <p className="text-[var(--apple-text-secondary)] text-sm">
            Track staff activity, deliveries, and engagement metrics.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Staff" value={formatNumber(data.totalStaff)} color="blue" />
        <StatCard label="Departments" value={formatNumber(Object.keys(data.departmentStats).length)} color="purple" />
        <StatCard
          label="Top Performer"
          value={topPerformer?.name?.split(' ')[0] || '—'}
          color="green"
        />
        <StatCard
          label="Top Actions"
          value={formatNumber(topPerformer?.totalActions ?? 0)}
          color="yellow"
        />
      </div>

      {/* Department Summary */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Department Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(data.departmentStats).sort((a, b) => b[1].totalActions - a[1].totalActions).map(([role, stats]) => (
            <button
              key={role}
              onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
              className={`rounded-xl p-3 text-center transition-all border-2 ${
                filterRole === role
                  ? 'border-[var(--apple-blue)] bg-[var(--apple-blue)]/5'
                  : 'border-[var(--apple-border)] hover:border-[var(--apple-blue)]/30'
              }`}
            >
              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-full mb-2 ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
                {role}
              </span>
              <p className="text-xl font-black text-[var(--apple-text-primary)]">{stats.count}</p>
              <p className="text-[10px] text-[var(--apple-text-secondary)] font-medium mt-0.5">
                {stats.avgActions} avg actions
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Technician / Courier Performance */}
      {data.techPerformance.length > 0 && (
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Delivery Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--apple-border)]">
                  <th className="text-left py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Name</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Deliveries</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Successful</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Avg Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.techPerformance.map(t => (
                  <tr key={t.technician_id} className="border-b border-[var(--apple-border)]/50 hover:bg-[var(--apple-gray-bg)]">
                    <td className="py-2.5 px-3 font-medium text-[var(--apple-text-primary)]">{t.technician_name || 'Unknown'}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{t.total_deliveries}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--apple-success)] font-bold">{t.successful_deliveries}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--apple-text-secondary)]">{Number(t.avg_delivery_hours).toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">
            All Employees
            {filterRole !== 'all' && (
              <span className="ml-2 text-sm font-medium text-[var(--apple-blue)]">({filterRole})</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="text-xs bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-lg px-3 py-1.5 font-medium text-[var(--apple-text-primary)] focus:outline-none focus:border-[var(--apple-blue)]"
            >
              <option value="all">All Roles</option>
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-lg px-3 py-1.5 font-medium text-[var(--apple-text-primary)] focus:outline-none focus:border-[var(--apple-blue)]"
            >
              <option value="actions">Sort: Actions</option>
              <option value="logins">Sort: Logins</option>
              <option value="deliveries">Sort: Deliveries</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <EmptyState title="No employees" description="No staff data available." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--apple-border)]">
                  <th className="text-left py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">#</th>
                  <th className="text-left py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Employee</th>
                  <th className="text-left py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Role</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Actions</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Logins</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Deliveries</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase">Rating</th>
                  <th className="text-right py-2 px-3 text-[var(--apple-text-secondary)] font-bold text-xs uppercase hidden sm:table-cell">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="border-b border-[var(--apple-border)]/50 hover:bg-[var(--apple-gray-bg)] transition-colors">
                    <td className="py-2.5 px-3 text-[var(--apple-text-tertiary)] font-bold">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--apple-blue)]/10 flex items-center justify-center text-xs font-black text-[var(--apple-blue)] shrink-0">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--apple-text-primary)] text-sm leading-tight">{emp.name}</p>
                          <p className="text-[10px] text-[var(--apple-text-tertiary)]">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${ROLE_COLORS[emp.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[var(--apple-text-primary)]">{emp.totalActions}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--apple-text-secondary)]">{emp.totalLogins}</td>
                    <td className="py-2.5 px-3 text-right">
                      {emp.deliveries > 0 ? (
                        <span className="font-bold text-[var(--apple-success)]">{emp.deliveries}</span>
                      ) : (
                        <span className="text-[var(--apple-text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {emp.avgRating > 0 ? (
                        <span className="font-bold text-amber-500 flex items-center justify-end gap-1">
                          {emp.avgRating.toFixed(1)} <span className="text-[10px]">★</span>
                        </span>
                      ) : (
                        <span className="text-[var(--apple-text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--apple-text-secondary)] text-xs hidden sm:table-cell">
                      {emp.lastLogin ? formatRelative(emp.lastLogin) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
