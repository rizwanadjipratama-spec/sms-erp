import { useState, useMemo } from 'react';
import type { FakturTask, FakturTaskType, Profile } from '@/types/types';
import { fakturService } from '@/lib/services';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format-utils';

interface FakturDispatchTabProps {
  tasks: FakturTask[];
  fakturUsers: Profile[];
  clients: Profile[];
  profile: { id: string; email: string; role: any };
  onRefresh: () => Promise<void>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function FakturDispatchTab({ tasks, fakturUsers, clients, profile, onRefresh }: FakturDispatchTabProps) {
  const [processing, setProcessing] = useState(false);
  const [clientId, setClientId] = useState('');
  const [taskType, setTaskType] = useState<FakturTaskType>('ttd_faktur');
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');

  const activeTasks = useMemo(() => tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled'), [tasks]);
  const historyTasks = useMemo(() => tasks.filter(t => t.status === 'completed' || t.status === 'cancelled'), [tasks]);

  const handleAssign = async () => {
    if (!clientId) return alert('Select a client');
    setProcessing(true);
    try {
      await fakturService.assignTask(
        clientId,
        taskType,
        assigneeId || null,
        notes,
        { id: profile.id, email: profile.email, role: profile.role }
      );
      setClientId('');
      setAssigneeId('');
      setNotes('');
      await onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error assigning task');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assign New Dispatch</h2>
          <p className="mt-1 text-sm text-gray-500">Send Faktur staff to clients for document signing or exchanges.</p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:border-emerald-500">
              <option value="">Select Client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <div>
              <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value as FakturTaskType)} className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:border-emerald-500">
                <option value="ttd_faktur">TTD Faktur</option>
                <option value="tukar_faktur">Tukar Faktur</option>
                <option value="others">Others</option>
              </select>
            </div>
             <div>
              <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Assign To (Optional)</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:border-emerald-500">
                <option value="">Any Available Staff</option>
                {fakturUsers.map(f => <option key={f.id} value={f.id}>{f.name || f.email}</option>)}
              </select>
            </div>
          </div>

          <div>
             <label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Notes / Instructions</label>
             <textarea 
               value={notes} 
               onChange={e => setNotes(e.target.value)} 
               rows={2} 
               className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:border-emerald-500 resize-none" 
               placeholder="Bring these specific invoices..." 
             />
          </div>

          <button
            onClick={handleAssign}
            disabled={processing || !clientId}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm mt-2"
          >
            {processing ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm max-h-[600px] flex flex-col">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Live Tracker</h2>
          <p className="mt-1 text-sm text-gray-500">Currently active dispatch tasks.</p>
        </div>
        <div className="flex-grow overflow-y-auto space-y-3">
          {!activeTasks.length ? (
             <EmptyState title="No Active Dispatches" description="All faktur tasks are completed or none assigned." icon="📋" />
          ) : (
            activeTasks.map(task => (
              <div key={task.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[task.status]}`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border">{task.task_type.replace('_', ' ')}</span>
                </div>
                <p className="font-semibold text-sm text-gray-900 truncate">{task.client?.company}</p>
                {task.scheduled_date && <p className="text-xs text-blue-600 font-medium">Scheduled: {formatDate(task.scheduled_date)}</p>}
                <p className="text-xs text-gray-500 mt-1">Assigned to: {task.assignee?.name || 'Unassigned pool'}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
