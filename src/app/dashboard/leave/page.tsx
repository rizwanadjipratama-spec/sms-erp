'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { leaveService } from '@/lib/services';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import type { LeaveRequest, Profile } from '@/types/types';
import { DashboardSkeleton, PageSpinner } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRelative } from '@/lib/format-utils';
import { supabase } from '@/lib/supabase';

// Helper
const isSupervisor = (role?: string | null) => 
  ['owner', 'admin', 'director', 'manager'].includes(role || '');

export default function LeaveDashboard() {
  const { profile, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'my-leaves' | 'approvals' | 'quotas'>('my-leaves');
  
  // Data State
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveRequest['type']>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
    if (!authLoading && profile && !canAccessRoute(profile.role, '/dashboard/leave')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [authLoading, profile, router]);

  // Data Fetch
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      // Refresh my leaves
      const mLeaves = await leaveService.getMyLeaves(profile.id);
      setMyLeaves(mLeaves);

      if (isSupervisor(role)) {
        const aLeaves = await leaveService.getAllLeaves();
        setAllLeaves(aLeaves);

        // Fetch all profiles for quota management
        const { data: pData } = await supabase.from('profiles').select('*').order('name', { ascending: true });
        if (pData) setProfiles(pData as Profile[]);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load leaves');
    } finally {
      setFetching(false);
    }
  }, [profile, role]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);


  // Submits
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (leaveType === 'sick' && !attachment) {
      alert('Sick leave requires a proof attachment (e.g. Doctor note).');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      alert('End date cannot be before start date.');
      return;
    }

    const daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    setIsSubmitting(true);
    try {
      await leaveService.submitLeave(
        profile.id,
        {
          type: leaveType,
          start_date: startDate,
          end_date: endDate,
          days_count: daysCount,
          reason,
        },
        attachment || undefined
      );

      // Reset form
      setLeaveType('annual');
      setStartDate('');
      setEndDate('');
      setReason('');
      setAttachment(null);
      alert('Leave request submitted successfully!');
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (leave: LeaveRequest) => {
    if (!profile || !confirm('Approve this leave request?')) return;
    try {
      await leaveService.approveLeave(leave.id, profile.id, leave.user_id, leave.type, leave.days_count);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const handleReject = async (leaveId: string) => {
    if (!profile) return;
    const reason = prompt('Please enter a rejection reason:');
    if (reason === null) return; // cancelled
    if (reason.trim() === '') {
      alert('Rejection reason is mandatory.');
      return;
    }
    try {
      await leaveService.rejectLeave(leaveId, profile.id, reason);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rejection failed');
    }
  };

  const handleUpdateBalance = async (userId: string, currentBalance: number) => {
    const newBalStr = prompt(`Enter new leave balance for this user (Currently ${currentBalance}):`, currentBalance.toString());
    if (newBalStr === null) return;
    
    const newBal = parseInt(newBalStr, 10);
    if (isNaN(newBal) || newBal < 0) {
      alert('Invalid balance provided.');
      return;
    }

    try {
      await leaveService.updateUserLeaveBalance(userId, newBal);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update balance');
    }
  };


  if (authLoading || (fetching && myLeaves.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && myLeaves.length === 0) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  const pendingCount = allLeaves.filter(l => l.status === 'pending').length;
  // Live user profile so we have exact DB balance
  const liveProf = isSupervisor(role) 
    ? profiles.find(p => p.id === profile?.id) 
    : undefined; // non supervisors don't load all profiles
  // Fallback to auth profile if live isn't fetched
  const myBalance = liveProf?.leave_balance ?? profile?.leave_balance ?? 0;

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Time Off</h1>
        <p className="text-apple-text-secondary text-sm mt-1 font-medium">
          Request absences, view balances, and approve leaves.
        </p>
      </div>

      {isSupervisor(role) && (
        <div className="flex border-b border-[var(--apple-gray-border)]">
          <button
            onClick={() => setActiveTab('my-leaves')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'my-leaves' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Absences
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'approvals' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Approvals
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('quotas')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'quotas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Staff Quotas
          </button>
        </div>
      )}

      {/* MY LEAVES TAB */}
      {activeTab === 'my-leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Request Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="apple-card p-6 border border-blue-100 bg-blue-50/30">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Your Quota</h3>
              <p className="text-4xl font-black text-blue-600">{myBalance} <span className="text-lg font-semibold text-gray-400">days</span></p>
            </div>

            <form onSubmit={handleSubmit} className="apple-card p-6 space-y-5">
              <h3 className="text-lg font-bold">Request Time Off</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leave Type</label>
                <select 
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveRequest['type'])}
                  className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow bg-white"
                  required
                >
                  <option value="annual">Cuti Tahunan (Annual)</option>
                  <option value="sick">Sakit (Sick Leave)</option>
                  <option value="maternity">Melahirkan (Maternity)</option>
                  <option value="marriage">Menikah (Marriage)</option>
                  <option value="unpaid">Unpaid / Bolos</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason / Note</label>
                <textarea
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  className="w-full text-sm rounded-lg border-[var(--apple-gray-border)] px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white resize-none"
                  placeholder="I need time off because..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Attachment {leaveType === 'sick' && <span className="text-red-500">* (Required)</span>}
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setAttachment(e.target.files?.[0] || null)}
                  required={leaveType === 'sick'}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-sm"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="lg:col-span-2">
            <div className="apple-card overflow-hidden">
              <div className="p-6 border-b border-[var(--apple-gray-border)] bg-gray-50">
                <h3 className="text-lg font-bold">Leave History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-[var(--apple-gray-border)] text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Dates</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--apple-gray-border)]">
                    {myLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No leaves requested yet.
                        </td>
                      </tr>
                    ) : (
                      myLeaves.map(leave => (
                        <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-semibold uppercase text-xs tracking-wider">{leave.type}</span>
                            {leave.attachment_url && (
                              <a href={leave.attachment_url} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-500 hover:underline mt-1">
                                View Proof
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold">{leave.start_date}</div>
                            <div className="text-xs text-gray-500">to {leave.end_date}</div>
                            <div className="text-[10px] text-gray-400 font-bold mt-0.5">{leave.days_count} days</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={leave.status} />
                            {leave.rejection_reason && (
                              <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={leave.rejection_reason}>
                                {leave.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs max-w-[200px] truncate text-gray-600" title={leave.reason}>
                              {leave.reason}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVALS TAB (Supervisors Only) */}
      {isSupervisor(role) && activeTab === 'approvals' && (
        <div className="apple-card overflow-hidden">
          <div className="p-6 border-b border-[var(--apple-gray-border)] bg-gray-50">
            <h3 className="text-lg font-bold">Pending Approvals</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b border-[var(--apple-gray-border)] text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Type & Dates</th>
                  <th className="px-6 py-4">Reason & Proof</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-gray-border)]">
                {allLeaves.filter(l => l.status === 'pending').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 font-medium">
                      All caught up! No pending approvals.
                    </td>
                  </tr>
                ) : (
                  allLeaves.filter(l => l.status === 'pending').map(leave => (
                    <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase shrink-0">
                            {(leave.profiles?.name || leave.profiles?.email || 'U')[0]}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{leave.profiles?.name || leave.profiles?.email}</div>
                            <div className="text-xs uppercase tracking-wider text-gray-500 font-bold">{leave.profiles?.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold uppercase text-[10px] tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mb-1">{leave.type}</span>
                        <div className="font-medium text-xs text-gray-700">{leave.start_date} to {leave.end_date}</div>
                        <div className="text-[10px] text-gray-500 font-bold mt-0.5">{leave.days_count} days</div>
                      </td>
                      <td className="px-6 py-4 max-w-[250px]">
                        <p className="text-xs text-gray-600 line-clamp-2" title={leave.reason}>
                          "{leave.reason}"
                        </p>
                        {leave.attachment_url && (
                          <a href={leave.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 hover:underline mt-2">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            VIEW PROOF
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleReject(leave.id)}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                          >
                            REJECT
                          </button>
                          <button
                            onClick={() => handleApprove(leave)}
                            className="px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                          >
                            APPROVE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* History of Approvals */}
          <div className="p-6 border-b border-t border-[var(--apple-gray-border)] bg-gray-50">
            <h3 className="text-base font-bold text-gray-600">Approval History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left opacity-75">
              <thead className="bg-white border-b border-[var(--apple-gray-border)] text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Details</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-gray-border)]">
                 {allLeaves.filter(l => l.status !== 'pending').slice(0, 10).map(leave => (
                   <tr key={leave.id}>
                     <td className="px-6 py-3 font-semibold text-xs">
                       {leave.profiles?.name || leave.profiles?.email}
                     </td>
                     <td className="px-6 py-3 text-xs">
                       {leave.type} ({leave.days_count} days)
                     </td>
                     <td className="px-6 py-3">
                        <StatusBadge status={leave.status} />
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUOTAS TAB (Supervisors Only) */}
      {isSupervisor(role) && activeTab === 'quotas' && (
        <div className="apple-card overflow-hidden">
          <div className="p-6 border-b border-[var(--apple-gray-border)] bg-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-bold">Staff Quotas</h3>
            <p className="text-xs text-gray-500 font-semibold">Click row to edit quota</p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map(p => (
              <button 
                key={p.id}
                onClick={() => handleUpdateBalance(p.id, p.leave_balance || 0)}
                className="text-left flex items-center justify-between p-4 rounded-xl border border-[var(--apple-gray-border)] hover:border-blue-300 hover:bg-blue-50/30 transition-all bg-white shadow-sm"
              >
                <div>
                  <div className="font-bold text-sm text-gray-900">{p.name || p.email}</div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mt-0.5">{p.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-blue-600">{p.leave_balance || 0}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Days</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
