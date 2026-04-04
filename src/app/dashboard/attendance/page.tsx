'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { attendanceService } from '@/lib/services';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import type { AttendanceRecord, Profile } from '@/types/types';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { supabase } from '@/lib/supabase';

const isSupervisor = (role?: string | null) =>
  ['owner', 'admin', 'director', 'manager'].includes(role || '');

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceDashboard() {
  const { profile, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'clock' | 'history' | 'admin'>('clock');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);
  const [allToday, setAllToday] = useState<AttendanceRecord[]>([]);
  const [streakData, setStreakData] = useState<Awaited<ReturnType<typeof attendanceService.getStreaksAndRankings>> | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [clocking, setClocking] = useState(false);

  // Clock-out form
  const [showClockOutForm, setShowClockOutForm] = useState(false);
  const [clockOutReason, setClockOutReason] = useState('');
  const [clockOutProof, setClockOutProof] = useState<File | null>(null);

  // Admin override
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideClockIn, setOverrideClockIn] = useState('08:00');
  const [overrideClockOut, setOverrideClockOut] = useState('16:00');
  const [overrideNote, setOverrideNote] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
    if (!authLoading && profile && !canAccessRoute(profile, '/dashboard/attendance')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [authLoading, profile, router]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const [today, monthly, streaks] = await Promise.all([
        attendanceService.getTodayRecord(profile.id),
        attendanceService.getMyMonthlyRecords(profile.id, currentMonth),
        attendanceService.getStreaksAndRankings(),
      ]);
      setTodayRecord(today);
      setMonthlyRecords(monthly);
      setStreakData(streaks);

      if (isSupervisor(role)) {
        const [todayAll, { data: pData }] = await Promise.all([
          attendanceService.getAllTodayRecords(),
          supabase.from('profiles').select('*').neq('role', 'client').order('name', { ascending: true }),
        ]);
        setAllToday(todayAll);
        if (pData) setProfiles(pData as Profile[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setFetching(false);
    }
  }, [profile, role, currentMonth]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // --- GPS helper ---
  const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS tidak didukung di browser ini.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(new Error(`GPS error: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  // --- CLOCK IN ---
  const handleClockIn = async () => {
    if (!profile?.branch_id) {
      alert('Branch belum di-assign ke profil kamu. Hubungi admin.');
      return;
    }
    setClocking(true);
    setGpsError(null);
    try {
      setGpsLoading(true);
      const pos = await getCurrentPosition();
      setGpsLoading(false);
      await attendanceService.clockIn(profile.id, profile.branch_id, pos.lat, pos.lng);
      refresh();
    } catch (err) {
      setGpsLoading(false);
      const msg = err instanceof Error ? err.message : 'Clock-in gagal';
      setGpsError(msg);
      alert(msg);
    } finally {
      setClocking(false);
    }
  };

  // --- CLOCK OUT ---
  const handleClockOut = async () => {
    if (!profile?.branch_id) return;

    // Check if we need a form (early/overtime)
    const wibNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const wibHour = wibNow.getUTCHours();
    const isSaturday = wibNow.getUTCDay() === 6;
    const expectedOut = isSaturday ? 14 : 16;
    const needsReason = wibHour < expectedOut || wibHour > expectedOut || (wibHour === expectedOut && wibNow.getUTCMinutes() > 0);

    if (needsReason && !showClockOutForm) {
      setShowClockOutForm(true);
      return;
    }

    setClocking(true);
    setGpsError(null);
    try {
      setGpsLoading(true);
      const pos = await getCurrentPosition();
      setGpsLoading(false);
      await attendanceService.clockOut(
        profile.id,
        profile.branch_id,
        pos.lat,
        pos.lng,
        clockOutReason || undefined,
        clockOutProof || undefined
      );
      setShowClockOutForm(false);
      setClockOutReason('');
      setClockOutProof(null);
      refresh();
    } catch (err) {
      setGpsLoading(false);
      const msg = err instanceof Error ? err.message : 'Clock-out gagal';
      setGpsError(msg);
      alert(msg);
    } finally {
      setClocking(false);
    }
  };

  // --- ADMIN OVERRIDE ---
  const handleAdminOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !overrideUserId || !overrideDate) return;

    const targetProfile = profiles.find(p => p.id === overrideUserId);
    if (!targetProfile?.branch_id) {
      alert('User belum punya branch. Assign branch dulu.');
      return;
    }

    try {
      const clockInISO = new Date(`${overrideDate}T${overrideClockIn}:00+07:00`).toISOString();
      const clockOutISO = overrideClockOut
        ? new Date(`${overrideDate}T${overrideClockOut}:00+07:00`).toISOString()
        : undefined;

      await attendanceService.adminOverride(
        profile.id,
        overrideUserId,
        targetProfile.branch_id,
        overrideDate,
        clockInISO,
        clockOutISO,
        overrideNote
      );
      alert('Override berhasil!');
      setOverrideUserId('');
      setOverrideDate('');
      setOverrideNote('');
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Override gagal');
    }
  };

  const handleRecoverStreak = async (recordId: string) => {
    const note = prompt('Alasan recovery streak (contoh: GPS error):');
    if (!note) return;
    try {
      await attendanceService.adminRecoverStreak(recordId, note);
      alert('Streak recovered!');
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Recovery gagal');
    }
  };

  if (authLoading || (fetching && !todayRecord && monthlyRecords.length === 0)) {
    return <div className="max-w-6xl mx-auto p-4"><DashboardSkeleton /></div>;
  }

  if (error && !todayRecord) {
    return <div className="max-w-6xl mx-auto p-4"><ErrorState message={error} onRetry={refresh} /></div>;
  }

  // Streak for current user
  const myOnTimeStreak = streakData?.onTimeLeaderboard.find(s => s.userId === profile?.id)?.streak || 0;
  const myLateStreak = streakData?.lateStreakBoard.find(s => s.userId === profile?.id)?.streak || 0;

  // Monthly stats
  const totalPresent = monthlyRecords.length;
  const totalLate = monthlyRecords.filter(r => r.is_late).length;

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Attendance</h1>
        <p className="text-apple-text-secondary text-sm mt-1 font-medium">Clock in, track your streak, and view attendance records.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--apple-gray-border)]">
        <button onClick={() => setActiveTab('clock')} className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'clock' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Clock In/Out
        </button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Monthly History
        </button>
        {isSupervisor(role) && (
          <button onClick={() => setActiveTab('admin')} className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'admin' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Admin
          </button>
        )}
      </div>

      {/* ═══════ CLOCK TAB ═══════ */}
      {activeTab === 'clock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Clock buttons */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="apple-card p-6 text-center space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Today</h3>
              {!todayRecord ? (
                <div>
                  <p className="text-5xl font-black text-gray-300 mb-2">—</p>
                  <p className="text-sm text-gray-500">Belum absen masuk</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Masuk</p>
                      <p className="text-2xl font-black text-green-600">{formatTime(todayRecord.clock_in)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Pulang</p>
                      <p className="text-2xl font-black text-blue-600">{formatTime(todayRecord.clock_out)}</p>
                    </div>
                  </div>
                  {todayRecord.is_late && (
                    <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-600 border border-red-200">TERLAMBAT</span>
                  )}
                  {!todayRecord.is_late && todayRecord.clock_in && (
                    <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-green-50 text-green-600 border border-green-200">ON TIME</span>
                  )}
                </div>
              )}
            </div>

            {/* Clock In Button */}
            {!todayRecord && (
              <button
                onClick={handleClockIn}
                disabled={clocking}
                className="w-full py-4 px-6 rounded-2xl text-lg font-black text-white bg-green-600 hover:bg-green-700 active:scale-[0.97] transition-all disabled:opacity-50 shadow-lg shadow-green-200"
              >
                {gpsLoading ? '📡 Getting GPS...' : clocking ? 'Processing...' : '🕐 CLOCK IN'}
              </button>
            )}

            {/* Clock Out Button */}
            {todayRecord && !todayRecord.clock_out && (
              <div className="space-y-3">
                {!showClockOutForm ? (
                  <button
                    onClick={handleClockOut}
                    disabled={clocking}
                    className="w-full py-4 px-6 rounded-2xl text-lg font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.97] transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
                  >
                    {gpsLoading ? '📡 Getting GPS...' : clocking ? 'Processing...' : '🏠 CLOCK OUT'}
                  </button>
                ) : (
                  <div className="apple-card p-5 space-y-4">
                    <h4 className="text-sm font-bold text-gray-700">Clock Out — Reason & Proof</h4>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alasan</label>
                      <textarea
                        value={clockOutReason}
                        onChange={e => setClockOutReason(e.target.value)}
                        rows={2}
                        required
                        className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white resize-none"
                        placeholder="Contoh: Lembur meeting client..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bukti (foto/shareloc)</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={e => setClockOutProof(e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowClockOutForm(false)} className="flex-1 py-2 rounded-lg text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={handleClockOut}
                        disabled={clocking || !clockOutReason.trim()}
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {clocking ? 'Processing...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {todayRecord?.clock_out && (
              <div className="apple-card p-5 text-center bg-green-50/50 border-green-100">
                <p className="text-sm font-bold text-green-600">✅ Attendance complete for today!</p>
              </div>
            )}

            {gpsError && (
              <div className="apple-card p-4 bg-red-50 border-red-100">
                <p className="text-xs font-bold text-red-600">{gpsError}</p>
              </div>
            )}
          </div>

          {/* Right: Streak & Rankings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal streak */}
            <div className="grid grid-cols-2 gap-4">
              <div className="apple-card p-6 border border-green-100 bg-green-50/30 text-center">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">On-Time Streak</h3>
                <p className="text-4xl font-black text-green-600">{myOnTimeStreak}</p>
                <p className="text-xs text-gray-500 mt-1 font-semibold">hari berturut-turut</p>
                {myOnTimeStreak >= 5 && (
                  <p className="text-xs text-green-600 font-bold mt-2">🎉 Congrats! {myOnTimeStreak} hari on-time!</p>
                )}
              </div>
              <div className="apple-card p-6 text-center">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Bulan Ini</h3>
                <p className="text-4xl font-black text-blue-600">{totalPresent}</p>
                <p className="text-xs text-gray-500 mt-1 font-semibold">hari hadir</p>
                {totalLate > 0 && (
                  <p className="text-xs text-red-500 font-bold mt-2">⚠️ {totalLate}x terlambat</p>
                )}
                {totalLate >= 5 && (
                  <p className="text-[10px] text-red-600 font-bold mt-1">🚨 Sudah {totalLate}x telat! Mohon perbaiki.</p>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            {streakData && (
              <div className="apple-card overflow-hidden">
                <div className="p-5 border-b border-[var(--apple-gray-border)] bg-gray-50">
                  <h3 className="text-lg font-bold">🏆 On-Time Leaderboard</h3>
                </div>
                <div className="divide-y divide-[var(--apple-gray-border)]">
                  {streakData.onTimeLeaderboard.slice(0, 10).map((entry, i) => (
                    <div key={entry.userId} className={`flex items-center justify-between px-5 py-3 ${i < 3 ? 'bg-yellow-50/40' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                          i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{entry.name}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase">{entry.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-green-600">{entry.streak}</span>
                        <span className="text-xs text-gray-400 ml-1 font-bold">days</span>
                      </div>
                    </div>
                  ))}
                  {streakData.onTimeLeaderboard.length === 0 && (
                    <p className="px-5 py-4 text-sm text-gray-500">No attendance data yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Late streak */}
            {streakData && streakData.lateStreakBoard.length > 0 && (
              <div className="apple-card overflow-hidden">
                <div className="p-5 border-b border-[var(--apple-gray-border)] bg-red-50/50">
                  <h3 className="text-base font-bold text-red-700">⏰ Late Streak</h3>
                </div>
                <div className="divide-y divide-[var(--apple-gray-border)]">
                  {streakData.lateStreakBoard.slice(0, 5).map((entry, i) => (
                    <div key={entry.userId} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-black text-red-600">{i + 1}</div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{entry.name}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase">{entry.role}</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-red-600">{entry.streak} <span className="text-xs text-gray-400">days</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ HISTORY TAB ═══════ */}
      {activeTab === 'history' && (
        <div className="apple-card overflow-hidden">
          <div className="p-5 border-b border-[var(--apple-gray-border)] bg-gray-50">
            <h3 className="text-lg font-bold">Monthly Attendance — {currentMonth}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b border-[var(--apple-gray-border)] text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Clock In</th>
                  <th className="px-5 py-4">Clock Out</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-gray-border)]">
                {monthlyRecords.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No records this month.</td></tr>
                ) : monthlyRecords.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-semibold">{r.date}</td>
                    <td className="px-5 py-3 font-mono">{formatTime(r.clock_in)}</td>
                    <td className="px-5 py-3 font-mono">{formatTime(r.clock_out)}</td>
                    <td className="px-5 py-3">
                      {r.is_late && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-600 border border-red-200 mr-1">LATE</span>}
                      {r.is_early_leave && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-600 border border-orange-200 mr-1">EARLY</span>}
                      {r.is_overtime && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-600 border border-purple-200 mr-1">OT</span>}
                      {!r.is_late && !r.is_early_leave && !r.is_overtime && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-600 border border-green-200">OK</span>}
                      {r.is_manual && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500 ml-1">MANUAL</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {r.overtime_reason || r.early_leave_reason || r.manual_note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Summary */}
          <div className="p-5 border-t border-[var(--apple-gray-border)] bg-gray-50 flex gap-6 text-xs font-bold uppercase tracking-wider text-gray-500">
            <span>Present: <span className="text-blue-600 text-sm">{totalPresent}</span></span>
            <span>Late: <span className="text-red-600 text-sm">{totalLate}</span></span>
            <span>Early Leave: <span className="text-orange-600 text-sm">{monthlyRecords.filter(r => r.is_early_leave).length}</span></span>
            <span>Overtime: <span className="text-purple-600 text-sm">{monthlyRecords.filter(r => r.is_overtime).length}</span></span>
          </div>
        </div>
      )}

      {/* ═══════ ADMIN TAB ═══════ */}
      {isSupervisor(role) && activeTab === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Override Form */}
          <div className="apple-card p-6 space-y-5">
            <h3 className="text-lg font-bold">Manual Override</h3>
            <form onSubmit={handleAdminOverride} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</label>
                <select
                  value={overrideUserId}
                  onChange={e => setOverrideUserId(e.target.value)}
                  required
                  className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select employee...</option>
                  {profiles.filter(p => p.role !== 'client').map(p => (
                    <option key={p.id} value={p.id}>{p.name || p.email} ({p.role})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} required
                  className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clock In</label>
                  <input type="time" value={overrideClockIn} onChange={e => setOverrideClockIn(e.target.value)}
                    className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clock Out</label>
                  <input type="time" value={overrideClockOut} onChange={e => setOverrideClockOut(e.target.value)}
                    className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 bg-white" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Note</label>
                <input type="text" value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
                  placeholder="GPS error / internet mati..."
                  className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 bg-white" />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm">
                Submit Override
              </button>
            </form>
          </div>

          {/* Today's All Staff */}
          <div className="apple-card overflow-hidden">
            <div className="p-5 border-b border-[var(--apple-gray-border)] bg-gray-50">
              <h3 className="text-base font-bold">All Staff Today</h3>
            </div>
            <div className="divide-y divide-[var(--apple-gray-border)] max-h-[500px] overflow-y-auto">
              {profiles.filter(p => p.role !== 'client').map(p => {
                const rec = allToday.find(r => r.user_id === p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${rec?.clock_in ? (rec.is_late ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-300'}`} />
                      <div>
                        <p className="text-sm font-bold text-gray-900">{p.name || p.email}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase">{p.role}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {rec ? (
                        <div className="space-y-0.5">
                          <p className="font-mono font-bold">{formatTime(rec.clock_in)} {rec.clock_out ? `— ${formatTime(rec.clock_out)}` : ''}</p>
                          {rec.is_late && <span className="text-red-500 font-bold">LATE</span>}
                          {rec.is_manual && <span className="text-gray-400 font-bold ml-1">MANUAL</span>}
                          {rec.is_late && isSupervisor(role) && (
                            <button onClick={() => handleRecoverStreak(rec.id)} className="block text-blue-500 hover:text-blue-700 font-bold text-[10px] hover:underline">
                              Recover Streak
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 font-bold">NOT CLOCKED IN</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
