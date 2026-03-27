'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { DbRequest } from '@/types/types';
import { getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';
import { submitOrderIssue } from '@/lib/issues';

export default function IssuesPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [description, setDescription] = useState('');
  const [issues, setIssues] = useState<
    Array<{
      id: string;
      order_id: string;
      description: string;
      status: string;
      created_at: string;
    }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/client/issues')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('issues')
      .select('*')
      .eq('reported_by', profile.id)
      .order('created_at', { ascending: false });

    setIssues(data || []);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('issues', profile?.id ? `reported_by=eq.${profile.id}` : undefined, {
    enabled: Boolean(profile?.id),
    onEvent: refresh,
    debounceMs: 250,
    channelName: profile?.id ? `client-issues-page-${profile.id}` : undefined,
  });

  useRealtimeTable('requests', orderId ? `id=eq.${orderId}` : undefined, {
    enabled: Boolean(orderId),
    onEvent: refresh,
    debounceMs: 250,
    channelName: orderId ? `client-issue-request-${orderId}` : undefined,
  });

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !description.trim()) return;

    setSubmitting(true);
    try {
      const actor = await getCurrentAuthUser();
      const { data: requestRow, error: requestError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', orderId)
        .single();

      if (requestError) throw new Error(requestError.message);

      const request = requestRow as DbRequest;
      await submitOrderIssue(orderId, actor.id, description);

      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile?.role || 'client',
        nextStatus: 'issue',
        action: 'issue',
        message: `Issue reported for request ${request.id}`,
        type: 'warning',
        notifyRoles: ['admin', 'owner'],
        metadata: {
          description: description.trim(),
        },
      });

      setDescription('');
      await refresh();
      router.push('/dashboard/client');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit issue');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/client" className="text-gray-500 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report an Issue</h1>
          <p className="text-gray-500 text-sm mt-1">Tell the team what happened with this delivery.</p>
        </div>
      </div>

      {orderId && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Issue Details</h2>
          <form onSubmit={submitIssue} className="space-y-4">
            <div className="text-xs text-gray-500">Order ID: {orderId}</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
              placeholder="Describe the issue..."
            />
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Issue'}
            </button>
          </form>
        </div>
      )}

      {issues.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Issues</h2>
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {issue.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(issue.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{issue.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
