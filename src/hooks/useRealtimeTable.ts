'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type RealtimeTableEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';

type UseRealtimeTableOptions = {
  filter?: string;
  schema?: string;
  event?: RealtimeTableEvent;
  debounceMs?: number;
  enabled?: boolean;
  channelName?: string;
  onEvent?: () => void | Promise<void>;
};

export function useRealtimeTable(
  tableName: string,
  filter?: string,
  options?: Omit<UseRealtimeTableOptions, 'filter'>
) {
  const {
    schema = 'public',
    event = '*',
    debounceMs = 300,
    enabled = true,
    channelName,
    onEvent,
  } = options || {};

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventKeyRef = useRef<string | null>(null);
  const callbackRef = useRef<typeof onEvent>(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !callbackRef.current) return;

    const scheduleRefresh = (eventKey?: string) => {
      if (eventKey && lastEventKeyRef.current === eventKey) {
        return;
      }

      if (eventKey) {
        lastEventKeyRef.current = eventKey;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void callbackRef.current?.();
      }, debounceMs);
    };

    const resolvedChannelName =
      channelName || `realtime:${tableName}:${filter || 'all'}:${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(resolvedChannelName)
      .on(
        'postgres_changes',
        {
          event,
          schema,
          table: tableName,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const eventKey = [
            payload.eventType,
            payload.table,
            payload.commit_timestamp,
            payload.new && 'id' in payload.new ? String(payload.new.id) : '',
            payload.old && 'id' in payload.old ? String(payload.old.id) : '',
          ].join(':');

          scheduleRefresh(eventKey);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          scheduleRefresh(`subscribed:${resolvedChannelName}`);
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          scheduleRefresh(`reconnect:${resolvedChannelName}:${Date.now()}`);
        }
      });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, event, filter, schema, tableName, onEvent]);
}
