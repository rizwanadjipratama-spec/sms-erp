'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { requestNotesDb } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { formatRelative } from '@/lib/format-utils';
import type { RequestNote, UserRole } from '@/types/types';

// Role display config
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:     { label: 'Client',     color: 'bg-blue-100 text-blue-700' },
  marketing:  { label: 'Marketing',  color: 'bg-purple-100 text-purple-700' },
  boss:       { label: 'Boss',       color: 'bg-amber-100 text-amber-700' },
  finance:    { label: 'Finance',    color: 'bg-emerald-100 text-emerald-700' },
  warehouse:  { label: 'Warehouse',  color: 'bg-orange-100 text-orange-700' },
  courier:    { label: 'Courier',    color: 'bg-cyan-100 text-cyan-700' },
  technician: { label: 'Technician', color: 'bg-rose-100 text-rose-700' },
  admin:      { label: 'Admin',      color: 'bg-gray-100 text-gray-700' },
  owner:      { label: 'Owner',      color: 'bg-indigo-100 text-indigo-700' },
  director:   { label: 'Director',   color: 'bg-violet-100 text-violet-700' },
  manager:    { label: 'Manager',    color: 'bg-teal-100 text-teal-700' },
  purchasing: { label: 'Purchasing', color: 'bg-lime-100 text-lime-700' },
  faktur:     { label: 'Faktur',     color: 'bg-pink-100 text-pink-700' },
  tax:        { label: 'Tax',        color: 'bg-yellow-100 text-yellow-700' },
  claim_officer: { label: 'Claim Officer', color: 'bg-red-100 text-red-700' },
};

function getRoleBadge(role: string) {
  const config = ROLE_LABELS[role] || { label: role, color: 'bg-gray-100 text-gray-600' };
  return config;
}

interface OrderNotesProps {
  requestId: string;
  /** Roles this user is allowed to send notes to */
  allowedTargetRoles: UserRole[];
  /** Compact mode hides notes by default behind a toggle */
  compact?: boolean;
}

export function OrderNotes({ requestId, allowedTargetRoles, compact = false }: OrderNotesProps) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<RequestNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>(allowedTargetRoles[0]);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await requestNotesDb.getByRequest(requestId);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !profile) return;
    setSending(true);
    try {
      await requestNotesDb.create({
        request_id: requestId,
        from_user_id: profile.id,
        from_role: profile.role,
        to_role: targetRole,
        message: message.trim(),
      });
      setMessage('');
      await fetchNotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send note');
    } finally {
      setSending(false);
    }
  }, [message, profile, requestId, targetRole, fetchNotes]);

  // Memoize note count for the badge
  const noteCount = notes.length;

  if (!profile) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-sm font-bold text-gray-700">Notes</span>
          {noteCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {noteCount}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Notes list */}
          <div className="max-h-60 overflow-y-auto px-4 py-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No notes yet</p>
            ) : (
              notes.map((note) => {
                const fromBadge = getRoleBadge(note.from_role);
                const toBadge = getRoleBadge(note.to_role);
                const isMine = note.from_user_id === profile.id;

                return (
                  <div
                    key={note.id}
                    className={`p-3 rounded-lg border ${
                      isMine
                        ? 'bg-blue-50/50 border-blue-100'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${fromBadge.color}`}>
                        {fromBadge.label}
                      </span>
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${toBadge.color}`}>
                        {toBadge.label}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {note.sender?.name || note.sender?.email || 'Unknown'} · {formatRelative(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{note.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Compose area */}
          <div className="border-t border-gray-100 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">
                Send to
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as UserRole)}
                className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-blue-100 transition-colors"
              >
                {allowedTargetRoles.map((r) => {
                  const badge = getRoleBadge(r);
                  return (
                    <option key={r} value={r}>
                      {badge.label}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a note..."
                className="flex-1 text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {sending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
