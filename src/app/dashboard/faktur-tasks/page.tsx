'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { fakturService, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { formatDate, formatDateTime } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState } from '@/components/ui';
import type { FakturTask, Actor } from '@/types/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function FakturDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<FakturTask[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // local state for completion notes or schedule picks
  const [formState, setFormState] = useState<Record<string, { date?: string, note?: string }>>({});

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/faktur-tasks')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return { id: user.id, email: user.email ?? profile?.email, role };
  }, [profile, role]);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const data = await fakturService.getMyUpcomingTasks(profile.id);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setFetching(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) fetchData();
  }, [profile?.id, fetchData]);

  useRealtimeTable('faktur_tasks', undefined, fetchData, { enabled: Boolean(profile?.id) });

  const handleSchedule = async (task: FakturTask) => {
    const date = formState[task.id]?.date;
    if (!date) return alert('Date is required');
    setProcessingId(task.id);
    try {
      const actor = await getActor();
      await fakturService.updateTaskSchedule(task.id, date, actor);
      await fetchData();
    } catch(err) { alert(err instanceof Error ? err.message : 'Schedule error'); }
    finally { setProcessingId(null); }
  };

  const handleComplete = async (task: FakturTask) => {
    const note = formState[task.id]?.note;
    if (!note) return alert('Completion notes are required.');
    setProcessingId(task.id);
    try {
      const actor = await getActor();
      await fakturService.completeTask(task.id, note, actor);
      await fetchData();
    } catch(err) { alert(err instanceof Error ? err.message : 'Completion error'); }
    finally { setProcessingId(null); }
  };

  if (loading || fetching) return <div className="p-6 max-w-5xl mx-auto"><DashboardSkeleton /></div>;
  if (error) return <div className="p-6 max-w-5xl mx-auto"><ErrorState message={error} onRetry={fetchData} /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-[var(--apple-border)] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">Faktur & Finance Delivery</h1>
          <p className="text-sm text-[var(--apple-text-secondary)] mt-1">Manage Tukar Faktur scheduling and invoice dispatch runs.</p>
        </div>
        <div className="bg-[var(--apple-green)]/10 px-4 py-2 rounded-xl border border-[var(--apple-green)]/20 text-center">
            <span className="block text-2xl font-bold text-[var(--apple-green)]">{tasks.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--apple-green)]">Active Pool</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!tasks.length ? (
          <div className="col-span-full">
            <EmptyState icon="🧾" title="No Pending Tasks" description="You have no immediate tasks assigned from Finance." />
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col">
              {/* Type Ribbon */}
              <div className="absolute top-0 right-0 px-3 py-1 bg-gray-900 text-white text-[10px] uppercase font-bold tracking-wider rounded-bl-lg">
                {task.task_type.replace('_', ' ')}
              </div>

              <div className="mb-4 pr-16">
                <h3 className="font-bold text-lg text-[var(--apple-text-primary)] leading-tight">{task.client?.company || 'Unknown Client'}</h3>
                {task.client?.address && <p className="text-xs text-[var(--apple-text-secondary)] mt-1">📍 {task.client.address}</p>}
                {task.client?.pic_name && <p className="text-xs text-[var(--apple-text-secondary)] mt-0.5">👤 PIC: {task.client.pic_name} ({task.client.phone})</p>}
              </div>

              <div className="bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl p-3 mb-4 space-y-2 flex-grow">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[var(--apple-text-secondary)]">Task Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[task.status]}`}>
                    {task.status}
                  </span>
                </div>
                {task.notes && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[var(--apple-text-tertiary)] block mb-0.5">Note from Finance:</span>
                    <p className="text-sm text-[var(--apple-text-primary)] italic">"{task.notes}"</p>
                  </div>
                )}
                {task.scheduled_date && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[var(--apple-text-tertiary)] block mb-0.5">Scheduled For:</span>
                    <p className="text-sm font-semibold text-blue-600">{formatDate(task.scheduled_date)}</p>
                  </div>
                )}
                <div className="text-[10px] text-gray-400 text-right mt-2">
                  Created {formatDateTime(task.created_at)}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto">
                {task.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <input 
                      type="date" 
                      value={formState[task.id]?.date || ''}
                      onChange={e => setFormState(prev => ({ ...prev, [task.id]: { ...prev[task.id], date: e.target.value } }))}
                      className="w-full text-sm px-3 py-2 bg-white border border-[var(--apple-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--apple-blue)]/20 focus:border-[var(--apple-blue)]" 
                    />
                    <button
                      onClick={() => handleSchedule(task)}
                      disabled={processingId === task.id || !formState[task.id]?.date}
                      className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {processingId === task.id ? 'Saving...' : (task.assigned_to ? 'Confirm Schedule' : 'Claim & Schedule')}
                    </button>
                  </div>
                )}

                {task.status === 'scheduled' && (
                  <div className="flex flex-col gap-2">
                    <textarea 
                      placeholder="Visit outcomes, receipts, or resolution notes..."
                      value={formState[task.id]?.note || ''}
                      onChange={e => setFormState(prev => ({ ...prev, [task.id]: { ...prev[task.id], note: e.target.value } }))}
                      rows={2}
                      className="w-full text-sm px-3 py-2 bg-white border border-[var(--apple-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--apple-blue)]/20 focus:border-[var(--apple-blue)] resize-none" 
                    />
                    <button
                      onClick={() => handleComplete(task)}
                      disabled={processingId === task.id || !formState[task.id]?.note}
                      className="w-full py-2.5 bg-[var(--apple-success)] hover:opacity-90 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {processingId === task.id ? 'Processing...' : '✔ Mark Completed'}
                    </button>
                  </div>
                )}
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
