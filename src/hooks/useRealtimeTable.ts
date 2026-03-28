'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/db/client';

type RealtimeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeOptions {
  schema?: string;
  event?: RealtimeEvent;
  debounceMs?: number;
  enabled?: boolean;
}

export function useRealtimeTable(
  tableName: string,
  filter: string | undefined,
  onEvent: () => void | Promise<void>,
  options?: UseRealtimeOptions
) {
  const {
    schema = 'public',
    event = '*',
    debounceMs = 300,
    enabled = true,
  } = options ?? {};

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void callbackRef.current?.();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt:${tableName}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema,
          table: tableName,
          ...(filter ? { filter } : {}),
        },
        () => scheduleRefresh()
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [tableName, filter, schema, event, enabled, scheduleRefresh]);
}
