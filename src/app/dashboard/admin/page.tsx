'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { getRoleRedirect } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import type { DbRequest, Profile, UserRole } from '@/types/types';
import { getCurrentAuthUser } from '@/lib/workflow';
import { workflowEngine } from '@/lib/workflow-engine';
const ALL_ROLES: UserRole[] = ['client', 'marketing', 'boss', 'finance', 'warehouse', 'technician', 'admin', 'owner', 'tax'];

type IssueRow = {
  id: string;
  order_id: string;
  description: string;
  status: string;
  reported_by: string;
  created_at: string;
};

export default function AdminDashboard() {
  const PAGE_SIZE = 25;
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'issues'>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [requestMap, setRequestMap] = useState<Record<string, DbRequest>>({});
  const [search, setSearch] = useState('');
  const [usersLimit, setUsersLimit] = useState(PAGE_SIZE);
  const [issuesLimit, setIssuesLimit] = useState(PAGE_SIZE);
  const [saving, setSaving] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/admin')) {
      router.replace(getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  const refresh = useCallback(async () => {
    setFetching(true);
    const [userRes, issueRes, requestRes] = await Promise.all([
      supabase.from('profiles').select('*').order('email').limit(usersLimit),
      supabase
        .from('issues')
        .select('*')
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(issuesLimit),
      supabase.from('requests').select('*').in('status', ['issue', 'resolved']).limit(issuesLimit * 2),
    ]);

    const requestRows = (requestRes.data || []) as DbRequest[];
    setUsers((userRes.data || []) as Profile[]);
    setIssues((issueRes.data || []) as IssueRow[]);
    setRequestMap(
      requestRows.reduce<Record<string, DbRequest>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {})
    );
    setFetching(false);
  }, [issuesLimit, usersLimit]);

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile, refresh]);

  useRealtimeTable('profiles', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 300,
    channelName: 'admin-profiles',
  });

  useRealtimeTable('issues', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'admin-issues',
  });

  useRealtimeTable('requests', undefined, {
    enabled: Boolean(profile),
    onEvent: refresh,
    debounceMs: 250,
    channelName: 'admin-issue-requests',
  });

  const updateRole = async (email: string, newRole: UserRole) => {
    setSaving(email);
    await supabase.from('profiles').update({ role: newRole }).eq('email', email);
    setUsers((prev) => prev.map((user) => (user.email === email ? { ...user, role: newRole } : user)));
    setSaving(null);
  };

  const updateClientType = async (email: string, clientType: string) => {
    await supabase.from('profiles').update({ client_type: clientType }).eq('email', email);
    setUsers((prev) =>
      prev.map((user) =>
        user.email === email ? { ...user, client_type: clientType as 'regular' | 'kso' } : user
      )
    );
  };

  const resolveIssue = async (issue: IssueRow) => {
    setSaving(issue.id);
    try {
      const actor = await getCurrentAuthUser();
      const request = requestMap[issue.order_id];
      if (!request) throw new Error('Request not found for this issue');

      const { error: issueError } = await supabase
        .from('issues')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', issue.id);

      if (issueError) throw new Error(issueError.message);

      await workflowEngine.transitionOrder({
        request,
        actorId: actor.id,
        actorEmail: actor.email || profile?.email,
        actorRole: profile?.role || 'admin',
        nextStatus: 'resolved',
        action: 'resolved',
        message: `Issue resolved for request ${request.id}`,
        type: 'success',
        notifyRoles: ['owner'],
        metadata: {
          issue_id: issue.id,
        },
      });

      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to resolve issue');
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.email.toLowerCase().includes(search.toLowerCase()) ||
          (user.name || '').toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  );

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">Manage users and resolve operational issues.</p>
        </div>
        <Link
          href="/dashboard/admin/automation"
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm transition-colors"
        >
          Automation
        </Link>
        <Link
          href="/dashboard/admin/system-health"
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
        >
          System Health
        </Link>
        <Link
          href="/dashboard/admin/backups"
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm transition-colors"
        >
          Backups
        </Link>
      </div>

      <div className="flex gap-1 bg-white border-gray-200 shadow-sm p-1 rounded-lg w-fit border border-gray-200">
        {(['users', 'issues'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === item ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            {item === 'users' ? 'Users' : `Issues (${issues.length})`}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Users ({users.length})</h2>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border-gray-200 shadow-sm border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 w-56"
            />
          </div>
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div key={user.email} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{user.name || '(no name)'}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={user.role}
                      onChange={(e) => updateRole(user.email, e.target.value as UserRole)}
                      disabled={saving === user.email}
                      className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-red-500 disabled:opacity-50"
                    >
                      {ALL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {user.role === 'client' && (
                      <select
                        value={user.client_type || 'regular'}
                        onChange={(e) => updateClientType(user.email, e.target.value)}
                        className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-red-500"
                      >
                        <option value="regular">Regular</option>
                        <option value="kso">KSO</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>Debt: Rp{(user.debt_amount || 0).toLocaleString('id-ID')}</span>
                  <span>Limit: Rp{(user.debt_limit || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
            {users.length >= usersLimit && (
              <button
                onClick={() => setUsersLimit((prev) => prev + PAGE_SIZE)}
                className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
              >
                Load More Users
              </button>
            )}
          </div>
        </section>
      )}

      {tab === 'issues' && (
        <section className="space-y-4">
          {issues.length === 0 ? (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-10 text-center text-gray-500">
              No unresolved issues
            </div>
          ) : (
            issues.map((issue) => {
              const request = requestMap[issue.order_id];
              return (
                <div key={issue.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">Order {issue.order_id}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Reported {new Date(issue.created_at).toLocaleString('id-ID')}
                      </p>
                      {request && (
                        <p className="text-xs text-gray-500 mt-2">
                          Client: {request.user_email || request.user_id}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mt-3">{issue.description}</p>
                    </div>
                    <button
                      onClick={() => resolveIssue(issue)}
                      disabled={saving === issue.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving === issue.id ? 'Resolving...' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {issues.length >= issuesLimit && (
            <button
              onClick={() => setIssuesLimit((prev) => prev + PAGE_SIZE)}
              className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-slate-700 text-gray-700 text-sm transition-colors"
            >
              Load More Issues
            </button>
          )}
        </section>
      )}
    </div>
  );
}
