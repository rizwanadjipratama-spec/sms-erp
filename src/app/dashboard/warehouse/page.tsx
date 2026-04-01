'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { canAccessRoute } from '@/lib/permissions';
import { inventoryService, workflowEngine, authService } from '@/lib/services';
import { requireAuthUser } from '@/lib/db';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { DbRequest, InventoryLog, Actor } from '@/types/types';

import { useBranch } from '@/hooks/useBranch';
import { WarehouseConsole } from '@/components/dashboard/WarehouseConsole';

export default function WarehouseDashboard() {
  const { profile, role, loading } = useAuth();
  const { activeBranchId } = useBranch();
  const router = useRouter();

  // Data state
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && !canAccessRoute(profile.role, '/dashboard/warehouse')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [loading, profile, router]);

  // Build actor helper
  const getActor = useCallback(async (): Promise<Actor> => {
    const user = await requireAuthUser();
    return {
      id: user.id,
      email: user.email ?? profile?.email,
      role: role,
    };
  }, [profile, role]);

  // Data fetch
  const refresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await inventoryService.getWarehouseDashboard(activeBranchId);
      setRequests(data.requests);
    } catch (err) {
      console.error('Warehouse refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setFetching(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (profile) refresh();
  }, [profile, refresh, activeBranchId]);

  // Realtime subscriptions
  useRealtimeTable('requests', undefined, refresh, {
    enabled: Boolean(profile),
    debounceMs: 250,
  });

  // Order status transition
  const updateOrder = useCallback(
    async (request: DbRequest, status: 'preparing' | 'ready') => {
      if (!profile) return;
      setProcessingId(request.id);
      try {
        const actor = await getActor();

        // When preparing, consume stock first
        if (status === 'preparing') {
          await inventoryService.consumeStockForPreparing(request, actor);
        }

        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: status,
          action: status,
          message: status === 'preparing' ? `Preparing order` : `Order is ready for pickup`,
          type: status === 'ready' ? 'success' : 'info',
          notifyRoles: status === 'ready' ? ['technician', 'admin'] : ['admin'],
          metadata: { previous_status: request.status },
        });
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setProcessingId(null);
      }
    },
    [profile, getActor, refresh]
  );



  // Loading state
  if (loading || (fetching && requests.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <DashboardSkeleton />
      </div>
    );
  }

  // Error state
  if (error && requests.length === 0) {
    return (
      <div className="max-w-6xl mx-auto pb-24 p-4">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="space-y-12 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">
            Warehouse Console
          </h1>
          <p className="text-apple-text-secondary text-sm mt-1 font-medium">
            Global inventory and fulfillment tracking.
          </p>
        </div>
        <WarehouseConsole
          requests={requests}
          processingId={processingId}
          updateOrder={updateOrder}
        />
      </div>
    </div>
  );
}
