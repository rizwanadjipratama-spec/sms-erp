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

  if (!profile) return null;

  return (
    <div className="space-y-3">
      {/* Display Notes */}
      {!loading && notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note) => {
            const isMine = note.from_user_id === profile.id;
            const fromBadge = getRoleBadge(note.from_role);
            const toBadge = getRoleBadge(note.to_role);
            
            return (
              <div 
                key={note.id} 
                className={`rounded-xl border p-4 ${isMine ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                    {isMine ? 'Sent to' : 'From'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isMine ? toBadge.color : fromBadge.color}`}>
                    {isMine ? toBadge.label : fromBadge.label}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatRelative(note.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">
                  {note.message}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose Note */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Add Note For:
          </label>
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value as UserRole)}
            className="text-xs font-bold text-gray-700 bg-gray-100 border-none rounded-md px-2 py-1 outline-none cursor-pointer hover:bg-gray-200 transition-colors"
          >
            {allowedTargetRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]?.label || r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your request note here..."
            rows={1}
            className="flex-1 text-sm bg-transparent border-none outline-none resize-none pt-1 placeholder-gray-400 text-gray-800"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="self-end px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
