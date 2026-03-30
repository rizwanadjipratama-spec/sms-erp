import { useEffect, useRef } from 'react';
import { profilesDb } from '@/lib/db';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Sends a periodic heartbeat to update last_active_at on the user's profile.
 * This enables "active users right now" tracking on the company dashboard.
 */
export function useHeartbeat(userId: string | undefined) {
  const lastBeat = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const beat = () => {
      const now = Date.now();
      if (now - lastBeat.current < HEARTBEAT_INTERVAL_MS - 5000) return;
      lastBeat.current = now;
      profilesDb.heartbeat(userId).catch(() => {});
    };

    // Beat immediately on mount
    beat();

    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId]);
}
