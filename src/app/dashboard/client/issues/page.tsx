'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { issuesDb, requestsDb, requireAuthUser, storageDb } from '@/lib/db';
import { workflowEngine, technicianService } from '@/lib/services';
import { formatDate, formatOrderId, formatRelative } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatusBadge, StatCard, Modal } from '@/components/ui';
import type { Issue, DbRequest, ServiceIssue, ServiceIssueStatus, Actor } from '@/types/types';

const SERVICE_STATUS_LABELS: Record<ServiceIssueStatus, string> = {
  open: 'Waiting',
  otw: 'Tech On The Way',
  arrived: 'Tech Arrived',
  working: 'Being Fixed',
  completed: 'Resolved',
};

const SERVICE_STATUS_COLORS: Record<ServiceIssueStatus, string> = {
  open: 'bg-gray-100 text-gray-700',
  otw: 'bg-blue-100 text-blue-700',
  arrived: 'bg-indigo-100 text-indigo-700',
  working: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

type PageTab = 'report' | 'order-issues' | 'service-issues';

export default function IssuesPage() {
  const { profile, loading, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  // Tab state (default to report if orderId, otherwise service-issues)
  const [tab, setTab] = useState<PageTab>(orderId ? 'report' : 'service-issues');

  // Old order-level issues
  const [issues, setIssues] = useState<Issue[]>([]);
  const [orders, setOrders] = useState<DbRequest[]>([]);

  // New service Issues
  const [serviceIssues, setServiceIssues] = useState<ServiceIssue[]>([]);

  // Form state
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Order-level issue form
  const [orderDescription, setOrderDescription] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const [issueData, orderData] = await Promise.all([
        issuesDb.getByUser(profile.id),
        requestsDb.getByUser(profile.id),
      ]);
      setIssues(issueData);
      setOrders(orderData.data);

      // Refresh service issues
      try {
        const { serviceIssuesDb } = await import('@/lib/db');
        const siData = await serviceIssuesDb.getByReporter(profile.id);
        setServiceIssues(siData);
      } catch { /* table might not exist yet */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setFetching(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRealtimeTable('issues', profile?.id ? `reported_by=eq.${profile.id}` : undefined, fetchData, { enabled: Boolean(profile?.id), debounceMs: 300 });
  useRealtimeTable('service_issues', profile?.id ? `reported_by=eq.${profile.id}` : undefined, fetchData, { enabled: Boolean(profile?.id), debounceMs: 300 });

  // Target order
  const targetOrder = useMemo(() => {
    if (!orderId) return null;
    return orders.find(o => o.id === orderId) ?? null;
  }, [orderId, orders]);

  // Stats
  const stats = useMemo(() => ({
    orderOpen: issues.filter(i => i.status === 'open').length,
    orderInProgress: issues.filter(i => i.status === 'in_progress').length,
    orderResolved: issues.filter(i => i.status === 'resolved').length,
    serviceTotal: serviceIssues.length,
    serviceActive: serviceIssues.filter(i => i.status !== 'completed').length,
    serviceResolved: serviceIssues.filter(i => i.status === 'completed').length,
  }), [issues, serviceIssues]);

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allPhotos = [...photos, ...files].slice(0, 5); // Max 5
    setPhotos(allPhotos);
    setPhotoPreviewUrls(allPhotos.map(f => URL.createObjectURL(f)));
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit order-level issue
  const handleOrderIssue = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !orderDescription.trim() || !profile?.id || !targetOrder) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const user = await requireAuthUser();
      await issuesDb.create({ order_id: orderId, reported_by: profile.id, description: orderDescription.trim(), status: 'open' });
      await workflowEngine.transition({ request: targetOrder, actorId: user.id, actorEmail: profile.email, actorRole: 'client', nextStatus: 'issue', action: 'issue', message: `Issue reported for order ${formatOrderId(orderId)}`, type: 'warning', notifyRoles: ['admin', 'owner'], metadata: { description: orderDescription.trim() } });
      setOrderDescription('');
      await fetchData();
      router.push('/dashboard/client');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }, [orderId, orderDescription, profile, targetOrder, fetchData, router]);

  // Submit service issue (new)
  const handleServiceIssue = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim() || !description.trim() || !profile?.id) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const user = await requireAuthUser();
      const actor: Actor = { id: user.id, email: user.email ?? profile.email, role: role };

      // Upload photos first
      let photoUrls: string[] = [];
      if (photos.length) {
        const tempId = crypto.randomUUID();
        photoUrls = await Promise.all(
          photos.map(async (file) => {
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `issues/${tempId}/${crypto.randomUUID()}.${ext}`;
            return storageDb.upload('service-issues', path, file);
          })
        );
      }

      await technicianService.reportIssue({
        location: location.trim(),
        device_name: deviceName.trim() || undefined,
        description: description.trim(),
        notes: notes.trim() || undefined,
        photo_urls: photoUrls,
      }, actor);

      // Reset form
      setLocation('');
      setDeviceName('');
      setDescription('');
      setNotes('');
      setPhotos([]);
      setPhotoPreviewUrls([]);
      setTab('service-issues');
      await fetchData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }, [location, deviceName, description, notes, photos, profile, role, fetchData]);

  if (loading || fetching) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">Issues & Service Requests</h1>
          <p className="text-sm text-[var(--apple-text-secondary)]">Report problems and track technician progress.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Service Active" value={stats.serviceActive} color="yellow" />
        <StatCard label="Service Resolved" value={stats.serviceResolved} color="green" />
        <StatCard label="Order Issues" value={stats.orderOpen} color="red" />
        <StatCard label="Resolved" value={stats.orderResolved} color="blue" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--apple-gray-bg)] rounded-2xl p-1">
        <button onClick={() => setTab('report')} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${tab === 'report' ? 'bg-white text-[var(--apple-blue)] shadow-sm' : 'text-[var(--apple-text-secondary)]'}`}>
          📝 Report
        </button>
        <button onClick={() => setTab('service-issues')} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${tab === 'service-issues' ? 'bg-white text-[var(--apple-blue)] shadow-sm' : 'text-[var(--apple-text-secondary)]'}`}>
          🔧 Service ({serviceIssues.length})
        </button>
        <button onClick={() => setTab('order-issues')} className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${tab === 'order-issues' ? 'bg-white text-[var(--apple-blue)] shadow-sm' : 'text-[var(--apple-text-secondary)]'}`}>
          📦 Order ({issues.length})
        </button>
      </div>

      {/* Report Tab */}
      {tab === 'report' && (
        <div className="space-y-4">
          {/* Service Issue Report Form */}
          <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-bold text-[var(--apple-text-primary)] mb-4">🔧 Report Service Issue</h2>
            <p className="text-xs text-[var(--apple-text-secondary)] mb-4">Having a problem with equipment? Report it and a technician will be assigned.</p>
            <form onSubmit={handleServiceIssue} className="space-y-3">
              <input type="text" placeholder="Location (e.g. RS Harapan Bunda, Lab Lantai 2)" value={location} onChange={e => setLocation(e.target.value)} required
                className="w-full px-4 py-3 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all" />
              <input type="text" placeholder="Device name (optional)" value={deviceName} onChange={e => setDeviceName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all" />
              <textarea placeholder="Describe the problem in detail..." value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                className="w-full px-4 py-3 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all resize-none" />
              <textarea placeholder="Additional notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full px-4 py-3 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all resize-none" />

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-semibold text-[var(--apple-text-secondary)] mb-2">📷 Photos (max 5)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {photoPreviewUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-[var(--apple-border)]" />
                      <button type="button" onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <label className="w-20 h-20 border-2 border-dashed border-[var(--apple-border)] rounded-xl flex items-center justify-center cursor-pointer hover:border-[var(--apple-blue)] transition-colors">
                      <span className="text-2xl text-[var(--apple-text-tertiary)]">+</span>
                      <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <button type="submit" disabled={submitting || !location.trim() || !description.trim()} className="w-full py-3 bg-[var(--apple-blue)] hover:bg-[var(--apple-blue-hover)] text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? 'Submitting...' : '🔧 Report Service Issue'}
              </button>
            </form>
          </div>

          {/* Order Issue Form (when orderId is provided) */}
          {orderId && targetOrder && targetOrder.status === 'delivered' && (
            <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-bold text-[var(--apple-text-primary)] mb-4">📦 Report Order Issue</h2>
              <div className="rounded-lg bg-[var(--apple-gray-bg)] px-3 py-2 text-xs text-[var(--apple-text-secondary)] mb-3">
                Order: <span className="font-mono font-semibold">{formatOrderId(orderId)}</span>
              </div>
              <form onSubmit={handleOrderIssue} className="space-y-3">
                <textarea value={orderDescription} onChange={e => setOrderDescription(e.target.value)} rows={4} required placeholder="Describe the issue with this order..."
                  className="w-full px-4 py-3 bg-[var(--apple-gray-bg)] border border-[var(--apple-border)] rounded-xl text-sm text-[var(--apple-text-primary)] placeholder-[var(--apple-text-tertiary)] focus:outline-none focus:border-[var(--apple-blue)] focus:ring-2 focus:ring-[var(--apple-blue)]/20 transition-all resize-none" />
                <button type="submit" disabled={submitting || !orderDescription.trim()} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50">
                  {submitting ? 'Submitting...' : '📦 Submit Order Issue'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Service Issues Tab */}
      {tab === 'service-issues' && (
        <section>
          {!serviceIssues.length ? (
            <EmptyState title="No Service Issues" description="Report an equipment or service problem from the Report tab." />
          ) : (
            <div className="space-y-3">
              {serviceIssues.map(si => (
                <div key={si.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${SERVICE_STATUS_COLORS[si.status]}`}>
                      {SERVICE_STATUS_LABELS[si.status]}
                    </span>
                    <span className="text-xs text-[var(--apple-text-tertiary)]">{formatRelative(si.created_at)}</span>
                  </div>
                  <p className="text-sm font-bold text-[var(--apple-text-primary)] mb-1">{si.location}</p>
                  {si.device_name && <p className="text-xs text-[var(--apple-text-secondary)] mb-1">Device: {si.device_name}</p>}
                  <p className="text-sm text-[var(--apple-text-primary)] leading-relaxed mb-2">{si.description}</p>
                  {si.assignee && (
                    <p className="text-xs text-[var(--apple-text-secondary)]">Technician: <span className="font-semibold">{si.assignee.name || si.assignee.email}</span></p>
                  )}
                  {si.photo_urls?.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                      {si.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={url} alt={`Photo ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-[var(--apple-border)]" />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Status stepper */}
                  <div className="flex items-center gap-1 w-full mt-3 pt-3 border-t border-[var(--apple-border)]">
                    {(['open', 'otw', 'arrived', 'working', 'completed'] as ServiceIssueStatus[]).map((step, i) => {
                      const currentIdx = ['open', 'otw', 'arrived', 'working', 'completed'].indexOf(si.status);
                      return (
                        <div key={step} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full h-1.5 rounded-full ${i <= currentIdx ? 'bg-[var(--apple-blue)]' : 'bg-gray-200'} ${i === currentIdx ? 'animate-pulse' : ''}`} />
                          <span className={`text-[8px] font-bold uppercase ${i <= currentIdx ? 'text-[var(--apple-blue)]' : 'text-gray-400'}`}>
                            {SERVICE_STATUS_LABELS[step].split(' ').pop()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {si.status === 'completed' && si.resolution_note && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-3">
                      <p className="text-xs font-semibold text-green-700 mb-1">Resolution:</p>
                      <p className="text-sm text-green-800">{si.resolution_note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Order Issues Tab */}
      {tab === 'order-issues' && (
        <section>
          {!issues.length ? (
            <EmptyState title="No Order Issues" description="If a delivery has problems, you can report an issue from your orders." />
          ) : (
            <div className="space-y-3">
              {issues.map(issue => (
                <div key={issue.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${issue.status === 'open' ? 'bg-red-100 text-red-700' : issue.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {issue.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-[var(--apple-text-tertiary)]">{formatRelative(issue.created_at)}</span>
                  </div>
                  <p className="text-xs text-[var(--apple-text-secondary)] mb-1">Order: <span className="font-mono">{formatOrderId(issue.order_id)}</span></p>
                  <p className="text-sm text-[var(--apple-text-primary)]">{issue.description}</p>
                  {issue.resolution && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-3">
                      <p className="text-xs font-semibold text-green-700 mb-1">Resolution:</p>
                      <p className="text-sm text-green-800">{issue.resolution}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
