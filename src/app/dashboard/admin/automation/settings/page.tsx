'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { authService } from '@/lib/services';
import { automationService } from '@/lib/automation-service';
import { SYSTEM_EVENTS, type SystemEventType } from '@/lib/events';
import { canAccessRoute } from '@/lib/permissions';
import type { AutomationLog, AutomationWebhook } from '@/types/types';

export default function AutomationSettingsPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<AutomationWebhook[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [eventType, setEventType] = useState<SystemEventType>('request_created');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile, '/dashboard/admin')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
      const [nextWebhooks, nextLogs] = await Promise.all([
        automationService.getAutomationWebhooks(),
        automationService.getAutomationLogs(100),
      ]);
      setWebhooks(nextWebhooks);
      setLogs(nextLogs);
    } catch (error) {
      console.error('Automation settings fetch failed:', error);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('automation_webhooks', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  useRealtimeTable('automation_logs', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  const saveWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setSaving(true);
    try {
      await automationService.saveWebhook({
        eventType,
        webhookUrl: webhookUrl.trim(),
        active: true,
      });
      setWebhookUrl('');
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const toggleWebhook = async (webhook: AutomationWebhook) => {
    setSaving(true);
    try {
      await automationService.toggleWebhook(webhook.id, !webhook.active);
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update webhook');
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure outbound webhooks and inspect webhook delivery logs.</p>
        </div>
        <Link
          href="/dashboard/admin/automation"
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
        >
          Back to Automation
        </Link>
      </div>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Add Webhook</h2>
        <div className="grid md:grid-cols-[220px_1fr_auto] gap-3">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as SystemEventType)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-red-500"
          >
            {SYSTEM_EVENTS.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-n8n-webhook-url"
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={saveWebhook}
            disabled={saving || !webhookUrl.trim()}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Webhook'}
          </button>
        </div>
      </section>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configured Webhooks</h2>
        {webhooks.length === 0 ? (
          <p className="text-sm text-gray-500">No webhooks configured yet.</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{webhook.event_type}</p>
                  <p className="text-xs text-gray-500 mt-1 break-all">{webhook.webhook_url}</p>
                </div>
                <button
                  onClick={() => toggleWebhook(webhook)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                    webhook.active
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-gray-700'
                  }`}
                >
                  {webhook.active ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Webhook Logs</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No webhook logs yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 break-all">{log.webhook_url}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Event {log.event_id} • {new Date(log.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      log.status === 'success'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {log.status.toUpperCase()}
                  </span>
                </div>
                {log.response && (
                  <p className="text-xs text-gray-500 mt-3 break-words">{log.response}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
