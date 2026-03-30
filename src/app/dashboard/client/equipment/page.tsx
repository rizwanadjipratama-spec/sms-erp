'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { pmService } from '@/lib/services';
import { formatDate } from '@/lib/format-utils';
import { DashboardSkeleton, EmptyState, ErrorState, StatCard } from '@/components/ui';
import type { EquipmentAsset, PmSchedule } from '@/types/types';

const PM_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  missed: 'bg-red-100 text-red-700',
};

export default function ClientEquipmentPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const [assetsData, schedulesData] = await Promise.all([
        pmService.getClientAssets(profile.id),
        pmService.getClientPms(profile.id),
      ]);
      setAssets(assetsData);
      setSchedules(schedulesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load equipment data');
    } finally {
      setFetching(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useRealtimeTable('equipment_assets', profile?.id ? `client_id=eq.${profile.id}` : undefined, fetchData, { enabled: Boolean(profile?.id) });
  useRealtimeTable('pm_schedules', undefined, fetchData, { enabled: Boolean(profile?.id) }); // No direct RLS realtime on client_id for this table yet due to join, but good enough

  if (loading || fetching) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const activeAssets = assets.filter(a => a.status === 'active').length;
  const upcomingPms = schedules.filter(s => s.status !== 'completed' && s.status !== 'missed').length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">My Equipment Assets</h1>
          <p className="text-sm text-[var(--apple-text-secondary)]">View your registered devices and preventive maintenance schedules.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2">
        <StatCard label="Active Devices" value={activeAssets} color="blue" icon={<span className="text-lg">🔬</span>} />
        <StatCard label="Upcoming PMs" value={upcomingPms} color="yellow" icon={<span className="text-lg">📅</span>} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Assets List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">Registered Equipment</h2>
          {!assets.length ? (
            <EmptyState title="No Devices Found" description="You don't have any equipment registered to your account yet." icon="🔬" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {assets.map(asset => (
                <div key={asset.id} className="bg-white border border-[var(--apple-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${asset.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--apple-text-primary)] truncate text-base">{asset.product?.name || 'Unknown Device'}</h3>
                      <p className="text-xs font-mono text-[var(--apple-text-secondary)] mt-0.5">SN: {asset.serial_number}</p>
                    </div>
                    {asset.product?.image_url && (
                      <img src={asset.product.image_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-[var(--apple-border)] shrink-0" />
                    )}
                  </div>
                  
                  <div className="space-y-1.5 text-sm text-[var(--apple-text-secondary)] mb-4">
                    <p>📍 Location: <span className="font-medium text-[var(--apple-text-primary)]">{asset.area?.hospital_name || 'Main Clinic'}</span></p>
                    {asset.area?.area_name && <p className="pl-5 text-xs">Room: {asset.area.area_name}</p>}
                    <p>📅 Installed: <span className="font-medium text-[var(--apple-text-primary)]">{asset.installation_date ? formatDate(asset.installation_date) : 'N/A'}</span></p>
                    <p>⏱️ PM Frequency: <span className="font-medium text-[var(--apple-text-primary)]">Every {asset.pm_frequency_months} months</span></p>
                  </div>

                  <div className="flex gap-2">
                    <Link 
                      href={`/dashboard/client/issues?tab=report&device=${encodeURIComponent(asset.product?.name || '')}&location=${encodeURIComponent(asset.area?.hospital_name || '')}`}
                      className="flex-1 py-2 bg-[var(--apple-gray-bg)] hover:bg-gray-100 border border-[var(--apple-border)] rounded-xl text-xs font-bold text-[var(--apple-text-primary)] transition-colors flex items-center justify-center gap-1"
                    >
                      🔧 Report Issue
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: PM Schedules Menu */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--apple-text-primary)]">Maintenance Schedule</h2>
          {!schedules.length ? (
            <div className="bg-white border border-[var(--apple-border)] rounded-2xl p-8 text-center shadow-sm">
              <span className="text-3xl mb-3 block">✅</span>
              <p className="text-sm font-medium text-[var(--apple-text-primary)]">All caught up!</p>
              <p className="text-xs text-[var(--apple-text-secondary)] mt-1">No upcoming maintenance scheduled.</p>
            </div>
          ) : (
            <div className="bg-white border border-[var(--apple-border)] rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
              <div className="overflow-y-auto p-2 space-y-1">
                {schedules.map(pm => (
                  <div key={pm.id} className="p-3 rounded-xl hover:bg-[var(--apple-gray-bg)] transition-colors border border-transparent hover:border-[var(--apple-border)]">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${PM_STATUS_COLORS[pm.status]}`}>
                        {pm.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[11px] font-semibold whitespace-nowrap ${new Date(pm.due_date) < new Date() && pm.status !== 'completed' ? 'text-red-500' : 'text-[var(--apple-text-secondary)]'}`}>
                        Due: {formatDate(pm.due_date)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[var(--apple-text-primary)] truncate">{pm.asset?.product?.name}</p>
                    <p className="text-xs font-mono text-[var(--apple-text-secondary)] truncate">SN: {pm.asset?.serial_number}</p>
                    
                    {pm.status === 'completed' && pm.completed_at && (
                      <p className="text-[10px] text-green-600 font-medium mt-1">Completed: {formatDate(pm.completed_at)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
