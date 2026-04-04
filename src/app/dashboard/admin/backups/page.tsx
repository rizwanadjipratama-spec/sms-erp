'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { authService } from '@/lib/services';
import { backupService } from '@/lib/backup-service';
import { requireAuthUser } from '@/lib/db';
import { canAccessRoute } from '@/lib/permissions';
import type { BackupLog, UserRole } from '@/types/types';

export default function AdminBackupsPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/admin')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      setLogs(await backupService.getBackupLogs());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load backup history');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    void refresh();
  }, [profile, refresh]);

  useRealtimeTable('backup_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 350,
  });

  const withActor = async <T,>(action: (actor: { id: string; email?: string; role: UserRole }) => Promise<T>) => {
    if (!profile) throw new Error('Profile not available');
    const actor = await requireAuthUser();
    return action({
      id: actor.id,
      email: actor.email || profile.email,
      role: profile.role,
    });
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setRunning(key);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Backup operation failed');
    } finally {
      setRunning(null);
    }
  };

  const openDownload = async (log: BackupLog) => {
    await runAction(`download-${log.id}`, async () => {
      const url = await backupService.downloadBackup(log);
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  };

  if (loading || fetching) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-44 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-4 w-80 rounded bg-white border-gray-200 shadow-sm animate-pulse" />
          </div>
          <div className="h-10 w-28 rounded-lg bg-gray-100 animate-pulse" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-28 rounded bg-gray-100" />
              <div className="h-8 w-24 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backups</h1>
          <p className="text-gray-500 text-sm mt-1">Run database or storage backups, verify snapshots, and restore safely.</p>
        </div>
        <Link
          href="/dashboard/admin"
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
        >
          Back to Admin
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={() => runAction('backup-database', () => withActor((actor) => backupService.backupDatabase(actor).then(() => undefined)))}
          disabled={Boolean(running)}
          className="rounded-xl border border-gray-200 bg-white border-gray-200 shadow-sm p-5 text-left hover:border-cyan-500/40 transition-colors disabled:opacity-50"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Run Backup</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">Database Snapshot</p>
          <p className="text-sm text-gray-500 mt-2">Back up all operational tables into a JSON snapshot.</p>
        </button>
        <button
          onClick={() => runAction('backup-storage', () => withActor((actor) => backupService.backupStorage(actor).then(() => undefined)))}
          disabled={Boolean(running)}
          className="rounded-xl border border-gray-200 bg-white border-gray-200 shadow-sm p-5 text-left hover:border-violet-500/40 transition-colors disabled:opacity-50"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Run Backup</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">Storage Snapshot</p>
          <p className="text-sm text-gray-500 mt-2">Copy files from delivery proofs and documents into backup paths.</p>
        </button>
        <button
          onClick={() => runAction('backup-full', () => withActor((actor) => backupService.backupFullSystem(actor).then(() => undefined)))}
          disabled={Boolean(running)}
          className="rounded-xl border border-gray-200 bg-white border-gray-200 shadow-sm p-5 text-left hover:border-emerald-500/40 transition-colors disabled:opacity-50"
        >
          <p className="text-xs uppercase tracking-wider text-gray-500">Run Backup</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">Full System Snapshot</p>
          <p className="text-sm text-gray-500 mt-2">Run database and storage backups together and notify the owner.</p>
        </button>
      </div>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Backup History</h2>
            <p className="text-sm text-gray-500 mt-1">Recent backup runs and their current verification or restore status.</p>
          </div>
          {running && <p className="text-sm text-amber-300">Running: {running}</p>}
        </div>

        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-slate-950/50 p-6 text-center text-gray-500">
              No backups recorded yet.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-gray-200 bg-slate-950/40 p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 uppercase">{log.backup_type}</p>
                      <span
                        className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${
                          log.status === 'completed' || log.status === 'verified' || log.status === 'restored'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : log.status === 'failed'
                              ? 'bg-red-500/15 text-red-300'
                              : log.status === 'partial'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-slate-700 text-gray-600'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 break-all">Log ID: {log.id}</p>
                    {log.file_url && <p className="text-xs text-gray-500 break-all">File: {log.file_url}</p>}
                    <p className="text-xs text-gray-500">
                      Created {new Date(log.created_at).toLocaleString('id-ID')}
                      {log.completed_at ? ` • Completed ${new Date(log.completed_at).toLocaleString('id-ID')}` : ''}
                    </p>
                    {typeof log.size === 'number' && (
                      <p className="text-xs text-gray-500">Size: {log.size.toLocaleString('id-ID')} bytes</p>
                    )}
                    {log.notes && <p className="text-sm text-gray-600">{log.notes}</p>}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => runAction(`verify-${log.id}`, () => backupService.verifyBackup(log).then(() => undefined))}
                      disabled={Boolean(running) || !log.file_url}
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors disabled:opacity-50"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => runAction(`restore-${log.id}`, () => withActor((actor) => backupService.restoreBackup(log, actor).then(() => undefined)))}
                      disabled={Boolean(running) || !log.file_url}
                      className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm transition-colors disabled:opacity-50"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => void openDownload(log)}
                      disabled={Boolean(running) || !log.file_url}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm transition-colors disabled:opacity-50"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
