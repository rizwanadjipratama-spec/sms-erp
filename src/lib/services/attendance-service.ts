import { supabase } from '@/lib/supabase';
import type { AttendanceRecord, Branch, Profile } from '@/types/types';

// ============================================================================
// ATTENDANCE SERVICE — Clock-in/out, geofencing, streaks, rankings
// ============================================================================

/** Haversine distance in meters between two lat/lng points */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Get expected clock-out hour based on day of week (0=Sun) */
function getExpectedClockOutHour(date: Date): number {
  const day = date.getDay();
  return day === 6 ? 14 : 16; // Saturday=14:00, Mon-Fri=16:00
}

/** Check if a date is Sunday */
function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

export const attendanceService = {
  // ────────────────────────── CLOCK IN ──────────────────────────
  async clockIn(
    userId: string,
    userBranchId: string,
    lat: number,
    lng: number
  ): Promise<AttendanceRecord> {
    // 1. Validate: not Sunday
    const now = new Date();
    if (isSunday(now)) {
      throw new Error('Hari Minggu tidak perlu absen.');
    }

    // 2. Check if already clocked in today
    const today = now.toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      throw new Error('Kamu sudah absen masuk hari ini.');
    }

    // 3. Get branch for geofence validation
    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('id, name, latitude, longitude, geofence_radius')
      .eq('id', userBranchId)
      .single();

    if (branchErr || !branch) {
      throw new Error('Branch tidak ditemukan. Hubungi admin.');
    }

    if (!branch.latitude || !branch.longitude) {
      throw new Error('Koordinat kantor belum diatur. Hubungi admin.');
    }

    // 4. Geofence check
    const distance = haversineDistance(lat, lng, branch.latitude, branch.longitude);
    const radius = branch.geofence_radius || 150;

    if (distance > radius) {
      throw new Error(
        `Kamu terlalu jauh dari kantor ${branch.name}. Jarak: ${Math.round(distance)}m (maks ${radius}m).`
      );
    }

    // 5. Late check: after 08:00 local time (WIB = UTC+7)
    const wibHour = new Date(now.getTime() + 7 * 60 * 60 * 1000).getUTCHours();
    const wibMinute = new Date(now.getTime() + 7 * 60 * 60 * 1000).getUTCMinutes();
    const isLate = wibHour > 8 || (wibHour === 8 && wibMinute > 0);

    // 6. Insert record
    const { data: record, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: userId,
        branch_id: userBranchId,
        date: today,
        clock_in: now.toISOString(),
        clock_in_lat: lat,
        clock_in_lng: lng,
        is_late: isLate,
      })
      .select()
      .single();

    if (error) throw new Error(`Gagal absen masuk: ${error.message}`);
    return record;
  },

  // ────────────────────────── CLOCK OUT ──────────────────────────
  async clockOut(
    userId: string,
    userBranchId: string,
    lat: number,
    lng: number,
    reason?: string,
    proofFile?: File
  ): Promise<AttendanceRecord> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 1. Get today's record
    const { data: record, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (fetchErr || !record) {
      throw new Error('Kamu belum absen masuk hari ini.');
    }

    if (record.clock_out) {
      throw new Error('Kamu sudah absen pulang hari ini.');
    }

    // 2. Geofence check
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, latitude, longitude, geofence_radius')
      .eq('id', userBranchId)
      .single();

    if (branch?.latitude && branch?.longitude) {
      const distance = haversineDistance(lat, lng, branch.latitude, branch.longitude);
      const radius = branch.geofence_radius || 150;
      if (distance > radius) {
        throw new Error(
          `Kamu terlalu jauh dari kantor ${branch.name}. Jarak: ${Math.round(distance)}m (maks ${radius}m).`
        );
      }
    }

    // 3. Early leave / overtime check
    const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const wibHour = wibNow.getUTCHours();
    const expectedOut = getExpectedClockOutHour(now);
    const isEarlyLeave = wibHour < expectedOut;
    const isOvertime = wibHour >= expectedOut && (wibHour > expectedOut || wibNow.getUTCMinutes() > 0);

    // 4. Upload proof if provided
    let proof_url: string | null = null;
    if (proofFile) {
      const ext = proofFile.name.split('.').pop();
      const fileName = `attendance/${userId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('leave-attachments')
        .upload(fileName, proofFile);
      if (upErr) throw new Error(`Gagal upload bukti: ${upErr.message}`);
      const { data: urlData } = supabase.storage
        .from('leave-attachments')
        .getPublicUrl(fileName);
      proof_url = urlData.publicUrl;
    }

    // 5. Update record
    const { data: updated, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        clock_out: now.toISOString(),
        clock_out_lat: lat,
        clock_out_lng: lng,
        is_early_leave: isEarlyLeave,
        is_overtime: isOvertime,
        early_leave_reason: isEarlyLeave ? reason : null,
        overtime_reason: isOvertime ? reason : null,
        proof_url,
        updated_at: now.toISOString(),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateErr) throw new Error(`Gagal absen pulang: ${updateErr.message}`);
    return updated;
  },

  // ────────────────────────── QUERIES ──────────────────────────
  async getTodayRecord(userId: string): Promise<AttendanceRecord | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    return data;
  },

  async getMyMonthlyRecords(userId: string, yearMonth: string): Promise<AttendanceRecord[]> {
    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${lastDay}`;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAllTodayRecords(): Promise<AttendanceRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        profiles:user_id (id, name, email, avatar_url, role),
        branches:branch_id (id, name, code)
      `)
      .eq('date', today)
      .order('clock_in', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as any;
  },

  /** Get streaks & rankings across entire company */
  async getStreaksAndRankings(): Promise<{
    onTimeLeaderboard: { userId: string; name: string; avatar?: string; role: string; streak: number }[];
    lateStreakBoard: { userId: string; name: string; avatar?: string; role: string; streak: number }[];
  }> {
    // Fetch all attendance ordered by date desc
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select('user_id, date, is_late, profiles:user_id (id, name, email, avatar_url, role)')
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch approved leaves to exclude from streak calculation
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date')
      .eq('status', 'approved');

    const leaveMap = new Map<string, { start: string; end: string }[]>();
    (leaves || []).forEach(l => {
      const arr = leaveMap.get(l.user_id) || [];
      arr.push({ start: l.start_date, end: l.end_date });
      leaveMap.set(l.user_id, arr);
    });

    const isOnLeave = (userId: string, date: string): boolean => {
      const userLeaves = leaveMap.get(userId) || [];
      return userLeaves.some(l => date >= l.start && date <= l.end);
    };

    // Group by user
    const userRecords = new Map<string, { date: string; is_late: boolean; profile: any }[]>();
    (records || []).forEach((r: any) => {
      const arr = userRecords.get(r.user_id) || [];
      arr.push({ date: r.date, is_late: r.is_late, profile: r.profiles });
      userRecords.set(r.user_id, arr);
    });

    const onTimeStreaks: { userId: string; name: string; avatar?: string; role: string; streak: number }[] = [];
    const lateStreaks: { userId: string; name: string; avatar?: string; role: string; streak: number }[] = [];

    userRecords.forEach((recs, userId) => {
      // Sort by date desc
      const sorted = recs.sort((a, b) => b.date.localeCompare(a.date));
      const profile = sorted[0]?.profile;
      if (!profile) return;

      // On-time streak: count consecutive non-late days (skip leave days)
      let onTimeStreak = 0;
      for (const r of sorted) {
        if (isOnLeave(userId, r.date)) continue; // skip leave
        if (!r.is_late) onTimeStreak++;
        else break;
      }

      // Late streak: count consecutive late days
      let lateStreak = 0;
      for (const r of sorted) {
        if (isOnLeave(userId, r.date)) continue;
        if (r.is_late) lateStreak++;
        else break;
      }

      onTimeStreaks.push({
        userId,
        name: profile.name || profile.email,
        avatar: profile.avatar_url,
        role: profile.role,
        streak: onTimeStreak,
      });

      lateStreaks.push({
        userId,
        name: profile.name || profile.email,
        avatar: profile.avatar_url,
        role: profile.role,
        streak: lateStreak,
      });
    });

    // Sort descending by streak
    onTimeStreaks.sort((a, b) => b.streak - a.streak);
    lateStreaks.sort((a, b) => b.streak - a.streak);

    return {
      onTimeLeaderboard: onTimeStreaks,
      lateStreakBoard: lateStreaks.filter(s => s.streak > 0),
    };
  },

  /** Monthly report for a given YYYY-MM */
  async getMonthlyReport(yearMonth: string): Promise<{
    totalDays: number;
    records: AttendanceRecord[];
    summary: {
      userId: string;
      name: string;
      role: string;
      totalPresent: number;
      totalLate: number;
      totalEarlyLeave: number;
      totalOvertime: number;
      attendanceRate: number;
    }[];
  }> {
    const [y, m] = yearMonth.split('-');
    const lastDayStr = new Date(parseInt(y), parseInt(m), 0).getDate();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${lastDayStr}`;
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        profiles:user_id (id, name, email, role)
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw new Error(error.message);
    const records = (data || []) as any as AttendanceRecord[];

    // Count working days in the month (Mon-Sat)
    const start = new Date(`${yearMonth}-01`);
    const endMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    let workingDays = 0;
    for (let d = new Date(start); d <= endMonth; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) workingDays++; // Not Sunday
    }

    // Group by user
    const userMap = new Map<string, any[]>();
    records.forEach((r: any) => {
      const arr = userMap.get(r.user_id) || [];
      arr.push(r);
      userMap.set(r.user_id, arr);
    });

    const summary = Array.from(userMap.entries()).map(([userId, recs]) => {
      const profile = (recs[0] as any).profiles;
      return {
        userId,
        name: profile?.name || profile?.email || userId,
        role: profile?.role || 'unknown',
        totalPresent: recs.length,
        totalLate: recs.filter(r => r.is_late).length,
        totalEarlyLeave: recs.filter(r => r.is_early_leave).length,
        totalOvertime: recs.filter(r => r.is_overtime).length,
        attendanceRate: Math.round((recs.length / workingDays) * 100),
      };
    });

    return { totalDays: workingDays, records, summary };
  },

  // ────────────────────────── ADMIN ──────────────────────────
  async adminOverride(
    adminId: string,
    userId: string,
    branchId: string,
    date: string,
    clockIn: string,
    clockOut?: string,
    note?: string
  ): Promise<AttendanceRecord> {
    // Determine lateness
    const clockInDate = new Date(clockIn);
    const wibClockIn = new Date(clockInDate.getTime() + 7 * 60 * 60 * 1000);
    const isLate = wibClockIn.getUTCHours() > 8 || (wibClockIn.getUTCHours() === 8 && wibClockIn.getUTCMinutes() > 0);

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(
        {
          user_id: userId,
          branch_id: branchId,
          date,
          clock_in: clockIn,
          clock_out: clockOut || null,
          is_late: isLate,
          is_manual: true,
          manual_note: note || `Manual entry by admin`,
        },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single();

    if (error) throw new Error(`Admin override failed: ${error.message}`);
    return data;
  },

  /** Admin can recover a streak by marking a past late record as on-time */
  async adminRecoverStreak(recordId: string, note: string): Promise<void> {
    const { error } = await supabase
      .from('attendance_records')
      .update({
        is_late: false,
        is_manual: true,
        manual_note: note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (error) throw new Error(`Failed to recover streak: ${error.message}`);
  },
};
