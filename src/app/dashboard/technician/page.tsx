'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { technicianService, deliveryService, authService, pmService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { formatDateTime, formatRelative, formatDate } from '@/lib/format-utils';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import type { ServiceIssue, ServiceIssueStatus, Actor, AreaTransferRequest, PmSchedule, PmStatus } from '@/types/types';

type TabKey = 'pm-tasks' | 'area-issues' | 'general' | 'active' | 'knowledge' | 'areas';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'pm-tasks', label: 'PM Tasks', icon: '📅' },
  { key: 'area-issues', label: 'My Area', icon: '📍' },

  { key: 'general', label: 'General', icon: '📋' },
  { key: 'active', label: 'Active', icon: '🔧' },
  { key: 'knowledge', label: 'Knowledge', icon: '📚' },
  { key: 'areas', label: 'Areas', icon: '🏥' },
];

const STATUS_STEPS: { key: ServiceIssueStatus; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'otw', label: 'OTW' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'working', label: 'Working' },
  { key: 'completed', label: 'Done' },
];

const STATUS_COLORS: Record<ServiceIssueStatus, string> = {
  open: 'bg-gray-100 text-gray-700',
  otw: 'bg-blue-100 text-blue-700',
  arrived: 'bg-indigo-100 text-indigo-700',
  working: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

function IssueStatusStepper({ status }: { status: ServiceIssueStatus }) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return (
    <div className="flex items-center gap-1 w-full">
      {STATUS_STEPS.map((step, i) => (
        <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
          <div className={`w-full h-1.5 rounded-full transition-all ${i <= idx ? 'bg-[var(--apple-blue)]' : 'bg-gray-200'} ${i === idx ? 'animate-pulse' : ''}`} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${i <= idx ? 'text-[var(--apple-blue)]' : 'text-gray-400'}`}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

function IssueCard({
  issue,
  onTake,
  onAdvance,
  onComplete,
  processingId,
  notes,
  setNotes,
  showTake = false,
  showActions = false,
}: {
  issue: ServiceIssue;
  onTake?: (id: string) => void;
  onAdvance?: (id: string, next: ServiceIssueStatus) => void;
  onComplete?: (id: string) => void;
  processingId: string | null;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showTake?: boolean;
  showActions?: boolean;
}) {
  const nextStatus = (): ServiceIssueStatus | null => {
    const idx = STATUS_STEPS.findIndex(s => s.key === issue.status);
    if (idx < 0 || idx >= STATUS_STEPS.length - 1) return null;
    return STATUS_STEPS[idx + 1].key;
  };
  const next = nextStatus();
  const isLast = issue.status === 'working';

  return (
    <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--apple-text-primary)] text-sm truncate">{issue.location}</p>
          {issue.device_name && <p className="text-xs text-[var(--apple-text-secondary)] mt-0.5">Device: {issue.device_name}</p>}
          <p className="text-xs text-[var(--apple-text-tertiary)] mt-0.5">{formatRelative(issue.created_at)}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_COLORS[issue.status]}`}>
          {issue.status}
        </span>
      </div>

      {/* Reporter */}
      {issue.reporter && (
        <p className="text-xs text-[var(--apple-text-secondary)] mb-2">
          Reported by: <span className="font-semibold">{issue.reporter.name || issue.reporter.email}</span>
          {issue.reporter.company && <span className="text-[var(--apple-text-tertiary)]"> · {issue.reporter.company}</span>}
        </p>
      )}

      {/* Description */}
      <div className="bg-[var(--apple-gray-bg)] rounded-xl p-3 mb-3 border border-[var(--apple-border)]">
        <p className="text-sm text-[var(--apple-text-primary)] leading-relaxed">{issue.description}</p>
        {issue.notes && <p className="text-xs text-[var(--apple-text-secondary)] mt-2 italic">{issue.notes}</p>}
      </div>

      {/* Photos */}
      {issue.photo_urls?.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {issue.photo_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={url} alt={`Issue photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-[var(--apple-border)]" />
            </a>
          ))}
        </div>
      )}

      {/* Status Stepper (for active issues) */}
      {showActions && issue.status !== 'open' && issue.status !== 'completed' && (
        <div className="mb-4 p-3 bg-[var(--apple-gray-bg)] rounded-xl border border-[var(--apple-border)]">
          <IssueStatusStepper status={issue.status} />
        </div>
      )}

      {/* Area/Assignee info */}
      {issue.area && (
        <p className="text-xs text-[var(--apple-text-secondary)] mb-2">
          Area: <span className="font-medium">{issue.area.hospital_name}</span> — {issue.area.area_name}
        </p>
      )}
      {issue.assignee && (
        <p className="text-xs text-[var(--apple-text-secondary)] mb-2">
          Assigned to: <span className="font-semibold">{issue.assignee.name || issue.assignee.email}</span>
        </p>
      )}

      {/* Resolution */}
      {issue.status === 'completed' && issue.resolution_note && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
          <p className="text-xs font-semibold text-green-700 mb-1">Resolution:</p>
          <p className="text-sm text-green-800">{issue.resolution_note}</p>
        </div>
      )}

      {/* Actions */}
      {showTake && !issue.assigned_to && (
        <button
          onClick={() => onTake?.(issue.id)}
          disabled={processingId === issue.id}
          className="w-full py-2.5 bg-[var(--apple-blue)] hover:bg-[var(--apple-blue-hover)] text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processingId === issue.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🔧 Take Issue'}
        </button>
      )}

      {showActions && next && !isLast && (
        <button
          onClick={() => onAdvance?.(issue.id, next)}
          disabled={processingId === issue.id}
          className="w-full mb-2 py-2.5 bg-[var(--apple-blue)] hover:bg-[var(--apple-blue-hover)] text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processingId === issue.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : `Update to: ${STATUS_STEPS.find(s => s.key === next)?.label}`}
        </button>
      )}

      {showActions && isLast && (
        <div className="space-y-2">
          <textarea
            placeholder="Resolution note (required)..."
            value={notes[issue.id] || ''}
            onChange={e => setNotes(prev => ({ ...prev, [issue.id]: e.target.value }))}
            rows={2}
            className="w-full bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl px-3 py-2 text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 resize-none transition-all"
          />
          <button
            onClick={() => onComplete?.(issue.id)}
            disabled={processingId === issue.id || !notes[issue.id]?.trim()}
            className="w-full py-3 bg-[var(--apple-success)] hover:opacity-90 text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processingId === issue.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✅ Complete Issue'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TechnicianDashboard() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('area-issues');

  const [dashData, setDashData] = useState<Awaited<ReturnType<typeof technicianService.getTechnicianDashboard>> | null>(null);
  const [pmSchedules, setPmSchedules] = useState<Awaited<ReturnType<typeof pmService.getUpcomingPms>>>([]);
  const [knowledgeResults, setKnowledgeResults] = useState<ServiceIssue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/technician')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return { id: user.id, email: user.email ?? profile?.email, role };
  }, [profile, role]);

  // Fetch dashboard
  const refresh = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    setError(null);
    try {
      const data = await technicianService.getTechnicianDashboard(profile.id);
      setDashData(data);
      
      const areaIds = data.stats?.totalAreas ? data.myAreas?.map((a: any) => a.id) || [] : [];
      const pms = await pmService.getUpcomingPms(profile.id, areaIds);
      setPmSchedules(pms);
    } catch (err) {
      console.error('Technician dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh]);

  // Realtime
  useRealtimeTable('service_issues', undefined, refresh, { enabled: Boolean(profile), debounceMs: 300 });

  // Knowledge base search
  const searchKnowledgeBase = useCallback(async (query: string) => {
    try {
      const results = await technicianService.getKnowledgeBase(query || undefined);
      setKnowledgeResults(results);
    } catch (err) {
      console.error('KB search error:', err);
    }
  }, []);

  useEffect(() => {
    if (tab === 'knowledge') {
      searchKnowledgeBase(searchQuery);
    }
  }, [tab, searchQuery, searchKnowledgeBase]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleTake = useCallback(async (issueId: string) => {
    setProcessingId(issueId);
    try {
      const actor = await getActor();
      await technicianService.takeIssue(issueId, actor);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to take issue');
    } finally {
      setProcessingId(null);
    }
  }, [getActor, refresh]);

  const handleAdvance = useCallback(async (issueId: string, nextStatus: ServiceIssueStatus) => {
    setProcessingId(issueId);
    try {
      const actor = await getActor();
      await technicianService.updateIssueStatus(issueId, nextStatus, actor);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setProcessingId(null);
    }
  }, [getActor, refresh]);

  const handleComplete = useCallback(async (issueId: string) => {
    const note = notes[issueId]?.trim();
    if (!note) { alert('Resolution note is required'); return; }
    setProcessingId(issueId);
    try {
      const actor = await getActor();
      await technicianService.completeIssue(issueId, actor, note);
      setNotes(prev => { const n = { ...prev }; delete n[issueId]; return n; });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete issue');
    } finally {
      setProcessingId(null);
    }
  }, [getActor, refresh, notes]);

  const handleTransferRespond = useCallback(async (transferId: string, accept: boolean) => {
    setProcessingId(transferId);
    try {
      const actor = await getActor();
      await technicianService.respondToTransfer(transferId, accept, actor);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setProcessingId(null);
    }
  }, [getActor, refresh]);

  // ── Render ────────────────────────────────────────────────────────────
  if (loading || (fetching && !dashData)) {
    return <div className="max-w-6xl mx-auto space-y-6 p-4"><DashboardSkeleton /></div>;
  }

  if (error && !dashData) {
    return <div className="max-w-6xl mx-auto p-4"><ErrorState message={error} onRetry={refresh} /></div>;
  }

  const stats = dashData?.stats;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-bold text-[var(--apple-text-primary)] tracking-tight">Technician Dashboard</h1>
        <p className="text-[var(--apple-text-secondary)] text-sm">Manage issues, track progress, and build your knowledge base.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="My Areas" value={stats?.totalAreas ?? 0} color="blue" icon={<span className="text-lg">🏥</span>} />
        <StatCard label="Active Jobs" value={stats?.activeJobs ?? 0} color="yellow" icon={<span className="text-lg">🔧</span>} />
        <StatCard label="Area Issues" value={stats?.areaIssuesCount ?? 0} color="red" icon={<span className="text-lg">📍</span>} />
        <StatCard label="Open Pool" value={stats?.openCount ?? 0} color="green" icon={<span className="text-lg">📋</span>} />
      </div>

      {/* Transfer Requests Banner */}
      {(dashData?.pendingTransfers?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-3">📨 Transfer Requests ({dashData!.pendingTransfers.length})</h3>
          <div className="space-y-2">
            {dashData!.pendingTransfers.map(t => (
              <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl p-3 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-[var(--apple-text-primary)]">
                    {t.from_technician?.name || 'Unknown'} wants to transfer: <span className="font-bold">{t.area?.area_name || 'Unknown Area'}</span>
                  </p>
                  {t.note && <p className="text-xs text-[var(--apple-text-secondary)] mt-1">{t.note}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleTransferRespond(t.id, true)} disabled={processingId === t.id} className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">Accept</button>
                  <button onClick={() => handleTransferRespond(t.id, false)} disabled={processingId === t.id} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[var(--apple-gray-bg)] rounded-2xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 min-w-0 py-2.5 px-3 rounded-xl text-xs font-bold tracking-wide transition-all whitespace-nowrap ${
              tab === t.key
                ? 'bg-white text-[var(--apple-blue)] shadow-sm'
                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
            }`}
          >
            <span className="mr-1">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'pm-tasks' && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">Preventive Maintenance Tasks</h2>
          </div>
          {!pmSchedules.length ? (
            <EmptyState icon="📅" title="No PM Tasks" description="All caught up! No preventive maintenance scheduled for you or your areas right now." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {pmSchedules.map(pm => (
                <div key={pm.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[var(--apple-text-primary)] text-sm truncate">{pm.asset?.product?.name || 'Unknown Device'}</p>
                      <p className="text-xs text-[var(--apple-text-secondary)] mt-0.5 font-mono">SN: {pm.asset?.serial_number}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      pm.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                      pm.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      pm.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {pm.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="bg-[var(--apple-gray-bg)] rounded-xl p-3 mb-4 border border-[var(--apple-border)] space-y-1.5 text-xs text-[var(--apple-text-secondary)]">
                    <p>📍 Area: <span className="font-medium text-[var(--apple-text-primary)]">{pm.asset?.area?.hospital_name || 'Unassigned Area'}</span> — {pm.asset?.client?.company}</p>
                    <p>📅 Due: <span className={`font-medium ${new Date(pm.due_date) < new Date() && pm.status !== 'completed' ? 'text-red-500' : 'text-[var(--apple-text-primary)]'}`}>{formatDate(pm.due_date)}</span></p>
                    {pm.technician && <p>👤 Assigned to: <span className="font-medium text-[var(--apple-text-primary)]">{pm.technician.name || pm.technician.email}</span></p>}
                  </div>

                  {/* Actions */}
                  {!pm.technician_id && pm.status === 'pending' ? (
                    <button
                      onClick={async () => {
                        setProcessingId(pm.id);
                        try {
                          const actor = await getActor();
                          await pmService.claimPm(pm.id, actor);
                          await refresh();
                        } catch(err) { alert(err instanceof Error ? err.message : 'Error claiming PM'); }
                        finally { setProcessingId(null); }
                      }}
                      disabled={processingId === pm.id}
                      className="w-full py-2.5 bg-[var(--apple-blue)] hover:bg-[var(--apple-blue-hover)] text-white text-sm font-bold rounded-xl active:scale-95 transition-all flex justify-center gap-2"
                    >
                      {processingId === pm.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Claim PM Task'}
                    </button>
                  ) : pm.status === 'scheduled' && pm.technician_id === profile?.id ? (
                    <button
                      onClick={async () => {
                        setProcessingId(pm.id);
                        try {
                          const actor = await getActor();
                          await pmService.updatePmStatus(pm.id, 'in_progress', actor);
                          await refresh();
                        } catch(err) { alert(err instanceof Error ? err.message : 'Error updating PM'); }
                        finally { setProcessingId(null); }
                      }}
                      disabled={processingId === pm.id}
                      className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-all flex justify-center gap-2"
                    >
                      {processingId === pm.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Start Work'}
                    </button>
                  ) : pm.status === 'in_progress' && pm.technician_id === profile?.id ? (
                    <div className="space-y-2">
                       <textarea
                        placeholder="Maintenance notes/results..."
                        value={notes[pm.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [pm.id]: e.target.value }))}
                        rows={2}
                        className="w-full bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl px-3 py-2 text-sm text-[var(--apple-text-primary)] resize-none"
                      />
                      <button
                        onClick={async () => {
                          const note = notes[pm.id]?.trim();
                          if (!note) return alert('Notes are required to complete PM');
                          setProcessingId(pm.id);
                          try {
                            const actor = await getActor();
                            await pmService.completePm(pm.id, note, [], actor);
                            setNotes(prev => { const n = { ...prev }; delete n[pm.id]; return n; });
                            await refresh();
                          } catch(err) { alert(err instanceof Error ? err.message : 'Error completing PM'); }
                          finally { setProcessingId(null); }
                        }}
                        disabled={processingId === pm.id || !notes[pm.id]?.trim()}
                        className="w-full py-2.5 bg-[var(--apple-success)] hover:opacity-90 text-white text-sm font-bold rounded-xl active:scale-95 transition-all flex justify-center gap-2 disabled:opacity-50"
                      >
                       {processingId === pm.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✅ Finish Maintenance'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'area-issues' && (
        <section>
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">My Area Issues</h2>
          {!dashData?.areaIssues?.length ? (
            <EmptyState icon="📍" title="No Area Issues" description="No issues reported in your assigned areas." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {dashData.areaIssues.map(issue => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onTake={handleTake}
                  processingId={processingId}
                  notes={notes}
                  setNotes={setNotes}
                  showTake={!issue.assigned_to}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'general' && (
        <section>
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">General Issues Pool</h2>
          {!dashData?.openIssues?.length ? (
            <EmptyState icon="📋" title="No Open Issues" description="All issues are currently assigned. Check back later." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {dashData.openIssues.map(issue => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onTake={handleTake}
                  processingId={processingId}
                  notes={notes}
                  setNotes={setNotes}
                  showTake
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'active' && (
        <section>
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">My Active Jobs</h2>
          {!dashData?.myIssues?.length ? (
            <EmptyState icon="🔧" title="No Active Jobs" description="Take an issue from the General pool or your area to start." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {dashData.myIssues.map(issue => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onAdvance={handleAdvance}
                  onComplete={handleComplete}
                  processingId={processingId}
                  notes={notes}
                  setNotes={setNotes}
                  showActions
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'knowledge' && (
        <section>
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">Knowledge Base</h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search past issues, resolutions, devices, locations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all"
            />
          </div>
          {!knowledgeResults.length ? (
            <EmptyState icon="📚" title="No Results" description={searchQuery ? 'No issues match your search.' : 'No completed issues yet.'} />
          ) : (
            <div className="space-y-3">
              {knowledgeResults.map(issue => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  processingId={null}
                  notes={{}}
                  setNotes={() => {}}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'areas' && (
        <section>
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)] mb-4">My Assigned Areas</h2>
          {!dashData?.myAreas?.length ? (
            <EmptyState icon="🏥" title="No Areas Assigned" description="Contact admin to be assigned service areas." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashData.myAreas.map(area => (
                <div key={area.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                  <h3 className="font-bold text-[var(--apple-text-primary)] text-base mb-1">{area.hospital_name}</h3>
                  <p className="text-sm text-[var(--apple-blue)] font-medium mb-2">{area.area_name}</p>
                  {area.address && <p className="text-xs text-[var(--apple-text-secondary)] mb-1">📍 {area.address}</p>}
                  {area.phone && <p className="text-xs text-[var(--apple-text-secondary)] mb-1">📞 {area.phone}</p>}
                  {area.notes && <p className="text-xs text-[var(--apple-text-tertiary)] mt-2 italic">{area.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
