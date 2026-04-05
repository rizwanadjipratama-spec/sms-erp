'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { analyticsService, authService, autoApproveService } from '@/lib/services';
import type { AutoApproveSettings } from '@/lib/services';
import { profilesDb } from '@/lib/db';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format-utils';
import { DashboardSkeleton, StatCard, EmptyState, ErrorState } from '@/components/ui';
import type { CmsNews, CmsEvent, Profile, LeaveRequest, AttendanceRecord } from '@/types/types';
import { useBranch } from '@/hooks/useBranch';
import { leaveService, attendanceService } from '@/lib/services';

type CompanyData = Awaited<ReturnType<typeof analyticsService.getCompanyDashboard>>;

const isSupervisor = (role?: string | null) => 
  ['owner', 'admin', 'director', 'manager'].includes(role || '');

function getRandomQuote(quotes?: string[] | null) {
  if (!quotes || quotes.length === 0) return null;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ── Mini bar chart for revenue ──────────────────────────────────────────
function RevenueChart({ data }: { data: { month: string; total_revenue: number }[] }) {
  const reversed = [...data].reverse().slice(-6);
  const maxVal = Math.max(...reversed.map(d => d.total_revenue), 1);

  return (
    <div className="flex items-end gap-2 h-32">
      {reversed.map((item) => {
        const height = Math.max((item.total_revenue / maxVal) * 100, 4);
        const label = item.month?.slice(5) || '??'; // MM from YYYY-MM
        return (
          <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[var(--apple-blue)] rounded-t-md transition-all duration-500 min-w-[24px]"
              style={{ height: `${height}%` }}
              title={formatCurrency(item.total_revenue)}
            />
            <span className="text-[10px] font-bold text-[var(--apple-text-secondary)]">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CompanyDashboard() {
  const { profile, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<CompanyData | null>(null);
  const [activeUsers, setActiveUsers] = useState<Profile[]>([]);
  const [onLeaveUsers, setOnLeaveUsers] = useState<LeaveRequest[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [streakData, setStreakData] = useState<Awaited<ReturnType<typeof attendanceService.getStreaksAndRankings>> | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-approve settings
  const [autoSettings, setAutoSettings] = useState<AutoApproveSettings | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/company')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Fetch
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const [data, online, leaves, todayAtt, streaks] = await Promise.all([
        analyticsService.getCompanyDashboard(activeBranchId),
        profilesDb.getActiveUsers(5),
        leaveService.getActiveStatusBoard(),
        attendanceService.getAllTodayRecords(),
        attendanceService.getStreaksAndRankings(),
      ]);
      setDashboard(data);
      setActiveUsers(online);
      setOnLeaveUsers(leaves);
      setTodayAttendance(todayAtt);
      setStreakData(streaks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile, activeBranchId]);

  // Fetch auto-approve settings
  useEffect(() => {
    if (!activeBranchId || !isSupervisor(profile?.role)) return;
    autoApproveService.getSettings(activeBranchId).then(setAutoSettings);
  }, [activeBranchId, profile?.role]);

  const handleAutoSettingsSave = useCallback(async (updates: Partial<AutoApproveSettings>) => {
    if (!activeBranchId || !autoSettings) return;
    setSavingAuto(true);
    try {
      await autoApproveService.updateSettings(activeBranchId, updates);
      setAutoSettings(prev => prev ? { ...prev, ...updates } : prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingAuto(false);
    }
  }, [activeBranchId, autoSettings]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh, activeBranchId]);

  // Realtime for key tables
  useRealtimeTable('requests', undefined, refresh, { enabled: Boolean(profile), debounceMs: 500 });
  useRealtimeTable('invoices', undefined, refresh, { enabled: Boolean(profile), debounceMs: 500 });

  // Loading
  if (loading || (fetching && !dashboard)) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  if (!dashboard) return null;

  const { stats, monthlyRevenue, announcement, employeeOfMonth, news, events, ordersByStatus } = dashboard;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--apple-text-primary)] tracking-tight">
            Company Dashboard
          </h1>
          <p className="text-[var(--apple-text-secondary)] text-sm">
            PT Sarana Megamedilab Sejahtera — Overview
          </p>
        </div>
        <Link
          href="/dashboard/company/performance"
          className="bg-[var(--apple-blue)] hover:bg-[var(--apple-blue-hover)] text-white text-sm font-bold px-5 py-2 rounded-xl transition-all active:scale-95 shadow-sm text-center"
        >
          Employee Performance
        </Link>
      </div>

      {/* Announcement Banner */}
      {announcement && announcement.text && (
        <div className="bg-[var(--apple-blue)]/5 border border-[var(--apple-blue)]/15 rounded-xl p-4 flex items-center gap-3">
          <div className="text-[var(--apple-blue)] text-lg shrink-0">📢</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--apple-text-primary)]">{announcement.text}</p>
          </div>
          {announcement.link && (
            <a href={announcement.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-[var(--apple-blue)] hover:underline shrink-0">
              Read more
            </a>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Month Revenue" value={formatCurrency(stats.monthRevenue)} color="green" />
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} color="blue" />
        <StatCard label="Total Orders" value={formatNumber(stats.totalOrders)} color="purple" />
        <StatCard label="Total Deliveries" value={formatNumber(stats.totalDeliveries)} color="yellow" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Staff Members" value={formatNumber(stats.totalStaff)} color="blue" />
        <StatCard label="Clients" value={formatNumber(stats.totalClients)} color="green" />
        <StatCard label="Paid Invoices" value={formatNumber(stats.paidInvoices)} color="green" />
        <StatCard label="Unpaid Invoices" value={formatNumber(stats.unpaidInvoices)} color="red" />
      </div>

      {/* Active Users */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">
            Active Now
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-green-50 text-green-600 border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {activeUsers.length} online
            </span>
          </h2>
        </div>
        {activeUsers.length === 0 ? (
          <p className="text-sm text-[var(--apple-text-tertiary)]">No users active in the last 5 minutes.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {activeUsers.map(user => (
              <div key={user.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[var(--apple-blue)]/10 flex items-center justify-center text-xs font-black text-[var(--apple-blue)]">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--apple-text-primary)] leading-tight">{user.name || user.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[10px] text-[var(--apple-text-tertiary)] uppercase font-bold">{user.role}</p>
                    {user.avg_rating !== undefined && user.avg_rating > 0 && (
                      <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-1 py-0.5 rounded flex items-center">
                        ★ {user.avg_rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* On Leave Today */}
      {(onLeaveUsers.length > 0 || isSupervisor(profile?.role)) && (
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">
              Out of Office
              {onLeaveUsers.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                  {onLeaveUsers.length} on leave
                </span>
              )}
            </h2>
          </div>
          {onLeaveUsers.length === 0 ? (
            <p className="text-sm text-[var(--apple-text-tertiary)]">Everyone is active today.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {onLeaveUsers.map(leave => (
                <div key={leave.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50/50 border border-orange-100">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600">
                      {leave.profiles?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--apple-text-primary)] leading-tight">{leave.profiles?.name || leave.profiles?.email}</p>
                    <p className="text-[10px] text-orange-600 uppercase font-bold">{leave.type} • Until {leave.end_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's Attendance Overview */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">
            Today&apos;s Attendance
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-green-50 text-green-600 border border-green-200">
              {todayAttendance.length} clocked in
            </span>
            {todayAttendance.filter(a => a.is_late).length > 0 && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full bg-red-50 text-red-600 border border-red-200">
                {todayAttendance.filter(a => a.is_late).length} late
              </span>
            )}
          </h2>
        </div>
        {todayAttendance.length === 0 ? (
          <p className="text-sm text-[var(--apple-text-tertiary)]">No one has clocked in yet today.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {todayAttendance.map(att => (
              <div key={att.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${att.is_late ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: att.is_late ? '#fef2f2' : '#f0fdf4', color: att.is_late ? '#dc2626' : '#16a34a' }}>
                  {att.profiles?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--apple-text-primary)] leading-tight">{att.profiles?.name || att.profiles?.email}</p>
                  <p className={`text-[10px] uppercase font-bold ${att.is_late ? 'text-red-500' : 'text-green-600'}`}>
                    {att.is_late ? 'LATE' : 'ON TIME'} • {att.clock_in ? new Date(att.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Streak Leaderboard & Late */}
      {streakData && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* On-Time Leaderboard */}
          <div className="bg-white border border-[var(--apple-border)] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[var(--apple-border)] bg-green-50/30">
              <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">🏆 On-Time Leaderboard</h2>
            </div>
            <div className="divide-y divide-[var(--apple-border)]">
              {streakData.onTimeLeaderboard.slice(0, 5).map((entry, i) => (
                <div key={entry.userId} className={`flex items-center justify-between px-5 py-3 ${i < 3 ? 'bg-yellow-50/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                      i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</div>
                    <div>
                      <p className="text-sm font-bold">{entry.name}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{entry.role}</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-green-600">{entry.streak} <span className="text-xs text-gray-400">days</span></span>
                </div>
              ))}
              {streakData.onTimeLeaderboard.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-500">No data yet.</p>
              )}
            </div>
          </div>

          {/* Late Streak Board */}
          <div className="bg-white border border-[var(--apple-border)] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[var(--apple-border)] bg-red-50/30">
              <h2 className="text-lg font-bold text-red-700">⏰ Late Streak</h2>
            </div>
            <div className="divide-y divide-[var(--apple-border)]">
              {streakData.lateStreakBoard.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">No late streaks — great job team! 🎉</p>
              ) : streakData.lateStreakBoard.slice(0, 5).map((entry, i) => (
                <div key={entry.userId} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-black text-red-600">{i + 1}</div>
                    <div>
                      <p className="text-sm font-bold">{entry.name}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{entry.role}</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-red-600">{entry.streak} <span className="text-xs text-gray-400">days</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Monthly Revenue</h2>
          {monthlyRevenue.length > 0 ? (
            <RevenueChart data={monthlyRevenue} />
          ) : (
            <EmptyState title="No revenue data" description="Revenue data will appear once invoices are paid." />
          )}
        </div>

        {/* Employee of the Month */}
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Employee of the Month</h2>
          {employeeOfMonth ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--apple-blue)] to-purple-500 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                {employeeOfMonth.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-bold text-[var(--apple-text-primary)] text-lg flex items-center justify-center gap-2">
                  {employeeOfMonth.name || 'Unknown'}
                  {employeeOfMonth.avg_rating !== undefined && employeeOfMonth.avg_rating > 0 && (
                    <span className="text-xs font-bold text-amber-500 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded flex items-center">
                      ★ {employeeOfMonth.avg_rating.toFixed(1)}
                    </span>
                  )}
                </p>
                <p className="text-sm text-[var(--apple-text-secondary)]">{employeeOfMonth.email}</p>
                <span className="inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-200 uppercase">
                  {employeeOfMonth.role}
                </span>

                {employeeOfMonth.quotes && employeeOfMonth.quotes.length > 0 && (
                  <div className="mt-4 px-6 py-3 bg-[var(--apple-gray-bg)] rounded-xl border border-[var(--apple-border)]">
                    <p className="text-sm italic text-[var(--apple-text-primary)] relative">
                      <span className="text-2xl text-[var(--apple-blue)]/20 absolute -left-3 -top-2">"</span>
                      {getRandomQuote(employeeOfMonth.quotes)}
                      <span className="text-2xl text-[var(--apple-blue)]/20 absolute -bottom-4">"</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="Not set" description="Admin can set Employee of the Month in CMS." />
          )}
        </div>
      </div>

      {/* Auto Approval Settings (supervisors only) */}
      {isSupervisor(profile?.role) && autoSettings && (
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">⚡ Auto Approval Settings</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Toggle */}
            <div className="flex items-center justify-between sm:flex-col sm:items-start gap-2 p-4 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--apple-text-secondary)]">Auto Mode</p>
                <p className="text-[10px] text-[var(--apple-text-tertiary)] mt-0.5">Otomatis ACC/Reject di Boss</p>
              </div>
              <button
                onClick={() => handleAutoSettingsSave({ auto_approve_enabled: !autoSettings.auto_approve_enabled })}
                disabled={savingAuto}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  autoSettings.auto_approve_enabled
                    ? 'bg-emerald-500 focus:ring-emerald-500'
                    : 'bg-gray-300 focus:ring-gray-400'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-0.5 ${
                    autoSettings.auto_approve_enabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Min Spend */}
            <div className="p-4 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--apple-text-secondary)] mb-2">Min. Spend Auto ACC</p>
              <p className="text-[10px] text-[var(--apple-text-tertiary)] mb-2">Client baru dibawah ini harus manual</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--apple-text-secondary)]">Rp</span>
                <input
                  type="number"
                  value={autoSettings.auto_approve_min_spend}
                  onChange={(e) => setAutoSettings(prev => prev ? { ...prev, auto_approve_min_spend: Number(e.target.value) || 0 } : prev)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[var(--apple-blue)]/20 focus:border-[var(--apple-blue)]"
                />
              </div>
              <button
                onClick={() => handleAutoSettingsSave({ auto_approve_min_spend: autoSettings.auto_approve_min_spend })}
                disabled={savingAuto}
                className="mt-2 w-full text-[10px] font-bold py-1.5 bg-[var(--apple-blue)] text-white rounded-lg hover:bg-[var(--apple-blue-hover)] transition-colors disabled:opacity-50"
              >Simpan</button>
            </div>

            {/* Default Limit */}
            <div className="p-4 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--apple-text-secondary)] mb-2">Default Limit Client Baru</p>
              <p className="text-[10px] text-[var(--apple-text-tertiary)] mb-2">Limit piutang untuk client baru</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--apple-text-secondary)]">Rp</span>
                <input
                  type="number"
                  value={autoSettings.auto_approve_default_limit}
                  onChange={(e) => setAutoSettings(prev => prev ? { ...prev, auto_approve_default_limit: Number(e.target.value) || 0 } : prev)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-[var(--apple-blue)]/20 focus:border-[var(--apple-blue)]"
                />
              </div>
              <button
                onClick={() => handleAutoSettingsSave({ auto_approve_default_limit: autoSettings.auto_approve_default_limit })}
                disabled={savingAuto}
                className="mt-2 w-full text-[10px] font-bold py-1.5 bg-[var(--apple-blue)] text-white rounded-lg hover:bg-[var(--apple-blue-hover)] transition-colors disabled:opacity-50"
              >Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Pipeline */}
      <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Order Pipeline</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {[
            { key: 'submitted', label: 'Submitted', color: 'bg-gray-100 text-gray-700' },
            { key: 'priced', label: 'Priced', color: 'bg-blue-50 text-blue-700' },
            { key: 'approved', label: 'Approved', color: 'bg-indigo-50 text-indigo-700' },
            { key: 'invoice_ready', label: 'Invoice', color: 'bg-purple-50 text-purple-700' },
            { key: 'preparing', label: 'Preparing', color: 'bg-yellow-50 text-yellow-700' },
            { key: 'ready', label: 'Ready', color: 'bg-orange-50 text-orange-700' },
            { key: 'on_delivery', label: 'Delivery', color: 'bg-cyan-50 text-cyan-700' },
          ].map(s => (
            <div key={s.key} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-2xl font-black">{ordersByStatus[s.key] ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* News & Events Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* News */}
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Latest News</h2>
          {news.length === 0 ? (
            <EmptyState title="No news" description="Company news will appear here." />
          ) : (
            <div className="space-y-3">
              {news.map((item: CmsNews) => (
                <div key={item.id} className="p-3 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)]">
                  <p className="font-bold text-sm text-[var(--apple-text-primary)] line-clamp-1">{item.title}</p>
                  <p className="text-xs text-[var(--apple-text-secondary)] mt-1 line-clamp-2">{item.content}</p>
                  {item.published_at && (
                    <p className="text-[10px] text-[var(--apple-text-tertiary)] mt-2">
                      {new Date(item.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Upcoming Events</h2>
          {events.length === 0 ? (
            <EmptyState title="No events" description="Company events will appear here." />
          ) : (
            <div className="space-y-3">
              {events.map((item: CmsEvent) => (
                <div key={item.id} className="p-3 rounded-xl bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] flex items-start gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-[var(--apple-blue)]/10 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-[var(--apple-blue)] uppercase">
                      {item.event_date ? new Date(item.event_date).toLocaleDateString('id-ID', { month: 'short' }) : '—'}
                    </span>
                    <span className="text-lg font-black text-[var(--apple-blue)] leading-none">
                      {item.event_date ? new Date(item.event_date).getDate() : '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--apple-text-primary)] line-clamp-1">{item.title}</p>
                    {item.location && (
                      <p className="text-xs text-[var(--apple-text-secondary)] mt-0.5">{item.location}</p>
                    )}
                    {item.description && (
                      <p className="text-xs text-[var(--apple-text-tertiary)] mt-1 line-clamp-1">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
