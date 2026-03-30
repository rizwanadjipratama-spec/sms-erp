// ============================================================================
// DELIVERY SERVICE — Technician & Courier operations
// ============================================================================

import { requestsDb, deliveryLogsDb, storageDb, activityLogsDb } from '@/lib/db';
import type { Actor, DbRequest, DeliveryLog, DeliverySubStatus } from '@/types/types';

const ALLOWED_PROOF_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10MB

const SUB_STATUS_ORDER: DeliverySubStatus[] = ['otw', 'arrived', 'delivering', 'completed'];

export const deliveryService = {
  // ── Technician Dashboard ──────────────────────────────────────────────
  async getTechnicianDashboard(technicianId: string) {
    const [activeOrders, deliveryLogs] = await Promise.all([
      requestsDb.getByStatus(['ready', 'on_delivery', 'delivered']),
      deliveryLogsDb.getByTechnician(technicianId),
    ]);

    const techOrders = activeOrders.data.filter(
      r => r.assigned_technician_id === technicianId || (!r.assigned_technician_id && !r.assigned_courier_id && r.status === 'ready')
    );

    return {
      orders: techOrders,
      deliveryLogs,
      stats: {
        totalDeliveries: deliveryLogs.length,
        pendingPickup: techOrders.filter(r => r.status === 'ready').length,
        inTransit: techOrders.filter(r => r.status === 'on_delivery').length,
        delivered: techOrders.filter(r => r.status === 'delivered').length,
      },
    };
  },

  // ── Courier Dashboard ─────────────────────────────────────────────────
  async getCourierDashboard(courierId: string) {
    const [activeOrders, deliveryLogs] = await Promise.all([
      requestsDb.getByStatus(['ready', 'on_delivery', 'delivered']),
      deliveryLogsDb.getByCourier(courierId),
    ]);

    const courierOrders = activeOrders.data.filter(
      r => r.assigned_courier_id === courierId || (!r.assigned_courier_id && !r.assigned_technician_id && r.status === 'ready')
    );

    return {
      orders: courierOrders,
      deliveryLogs,
      stats: {
        totalDeliveries: deliveryLogs.length,
        pendingPickup: courierOrders.filter(r => r.status === 'ready').length,
        inTransit: courierOrders.filter(r => r.status === 'on_delivery').length,
        delivered: courierOrders.filter(r => r.status === 'delivered').length,
      },
    };
  },

  // ── Shared: Upload Proof ──────────────────────────────────────────────
  async uploadProof(file: File, orderId: string, _actor: Actor): Promise<string> {
    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed: PNG, JPG, JPEG, WEBP`);
    }
    if (file.size > MAX_PROOF_SIZE) {
      throw new Error(`File too large. Max: 10MB`);
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
    return storageDb.upload('delivery-proofs', path, file);
  },

  // ── Start Delivery (Technician or Courier) ────────────────────────────
  async startDelivery(request: DbRequest, actor: Actor, accompanyingStaff?: string): Promise<DbRequest> {
    if (actor.role !== 'technician' && actor.role !== 'courier') {
      throw new Error('Only technicians or couriers can start delivery');
    }

    const { workflowEngine } = await import('./workflow-engine');

    const isCourier = actor.role === 'courier';
    const extraUpdates: Record<string, unknown> = isCourier
      ? { assigned_courier_id: actor.id }
      : { assigned_technician_id: actor.id };

    const updatedRequest = await workflowEngine.transition({
      request,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      nextStatus: 'on_delivery',
      message: `Order is out for delivery`,
      action: 'start_delivery',
      type: 'info',
      extraUpdates,
    });

    // Create initial delivery log with sub-status 'otw'
    if (isCourier) {
      await deliveryLogsDb.create({
        order_id: request.id,
        courier_id: actor.id,
        status: 'otw',
        accompanying_staff: accompanyingStaff,
      });
    }

    return updatedRequest;
  },

  // ── Complete Delivery (Technician or Courier) ─────────────────────────
  async completeDelivery(params: {
    request: DbRequest;
    actor: Actor;
    note?: string;
    proofUrl?: string;
  }): Promise<{ request: DbRequest; deliveryLog: DeliveryLog }> {
    const { request, actor, note, proofUrl } = params;

    if (actor.role !== 'technician' && actor.role !== 'courier') {
      throw new Error('Only technicians or couriers can complete delivery');
    }

    const isCourier = actor.role === 'courier';

    // For courier: update existing delivery log to 'completed'
    // For technician: create new delivery log (legacy behavior)
    let deliveryLog: DeliveryLog;
    if (isCourier) {
      const logs = await deliveryLogsDb.getByOrder(request.id);
      const activeLog = logs.find(l => l.courier_id === actor.id && l.status !== 'completed');
      if (activeLog) {
        deliveryLog = await deliveryLogsDb.update(activeLog.id, {
          status: 'completed',
          note,
          proof_url: proofUrl,
          delivered_at: new Date().toISOString(),
        });
      } else {
        deliveryLog = await deliveryLogsDb.create({
          order_id: request.id,
          courier_id: actor.id,
          status: 'completed',
          note,
          proof_url: proofUrl,
          delivered_at: new Date().toISOString(),
        });
      }
    } else {
      deliveryLog = await deliveryLogsDb.create({
        order_id: request.id,
        technician_id: actor.id,
        status: 'delivered',
        note,
        proof_url: proofUrl,
        delivered_at: new Date().toISOString(),
      });
    }

    const { workflowEngine } = await import('./workflow-engine');
    const updatedRequest = await workflowEngine.transition({
      request,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      nextStatus: 'delivered',
      message: `Order has been delivered`,
      action: 'complete_delivery',
      type: 'success',
      notifyRequester: true,
    });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'complete_delivery',
      entity_type: 'delivery_log',
      entity_id: deliveryLog.id,
      metadata: { order_id: request.id, proof_url: proofUrl },
    });

    return { request: updatedRequest, deliveryLog };
  },

  // ── Update Delivery Sub-Status (Courier only) ────────────────────────
  async updateDeliverySubStatus(
    deliveryLogId: string,
    newStatus: DeliverySubStatus,
    actor: Actor,
  ): Promise<DeliveryLog> {
    if (actor.role !== 'courier') {
      throw new Error('Only couriers can update delivery sub-status');
    }

    const log = await deliveryLogsDb.getById(deliveryLogId);
    if (!log) throw new Error('Delivery log not found');
    if (log.courier_id !== actor.id) throw new Error('Not your delivery');

    // Validate sub-status ordering
    const currentIdx = SUB_STATUS_ORDER.indexOf(log.status as DeliverySubStatus);
    const newIdx = SUB_STATUS_ORDER.indexOf(newStatus);
    if (newIdx <= currentIdx) {
      throw new Error(`Cannot go from ${log.status} to ${newStatus}`);
    }

    return deliveryLogsDb.update(deliveryLogId, { status: newStatus });
  },

  // ── Get Delivery Tracking (for client dashboard) ─────────────────────
  async getDeliveryTracking(orderId: string): Promise<DeliveryLog | null> {
    const logs = await deliveryLogsDb.getByOrder(orderId);
    // Return the most recent active log
    return logs.find(l => l.status !== 'completed' && l.status !== 'delivered') ?? logs[0] ?? null;
  },

  async getDeliveryLogs(orderId: string) {
    return deliveryLogsDb.getByOrder(orderId);
  },
};
