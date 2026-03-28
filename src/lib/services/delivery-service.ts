// ============================================================================
// DELIVERY SERVICE — Technician operations
// ============================================================================

import { requestsDb, deliveryLogsDb, storageDb, activityLogsDb } from '@/lib/db';
import type { Actor, DbRequest, DeliveryLog } from '@/types/types';

const ALLOWED_PROOF_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10MB

export const deliveryService = {
  async getTechnicianDashboard(technicianId: string) {
    const [activeOrders, deliveryLogs] = await Promise.all([
      requestsDb.getByStatus(['ready', 'on_delivery', 'delivered']),
      deliveryLogsDb.getByTechnician(technicianId),
    ]);

    // Filter to only show orders assigned to this technician or unassigned ready orders
    const techOrders = activeOrders.data.filter(
      r => r.assigned_technician_id === technicianId || (!r.assigned_technician_id && r.status === 'ready')
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

  async uploadProof(file: File, orderId: string, actor: Actor): Promise<string> {
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

  async startDelivery(request: DbRequest, actor: Actor): Promise<DbRequest> {
    if (actor.role !== 'technician') {
      throw new Error('Only technicians can start delivery');
    }

    // Import here to avoid circular dependency
    const { workflowEngine } = await import('./workflow-engine');

    return workflowEngine.transition({
      request,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      nextStatus: 'on_delivery',
      message: `Order is out for delivery`,
      action: 'start_delivery',
      type: 'info',
      extraUpdates: { assigned_technician_id: actor.id },
    });
  },

  async completeDelivery(params: {
    request: DbRequest;
    actor: Actor;
    note?: string;
    proofUrl?: string;
  }): Promise<{ request: DbRequest; deliveryLog: DeliveryLog }> {
    const { request, actor, note, proofUrl } = params;

    if (actor.role !== 'technician') {
      throw new Error('Only technicians can complete delivery');
    }

    // Create delivery log
    const deliveryLog = await deliveryLogsDb.create({
      order_id: request.id,
      technician_id: actor.id,
      status: 'delivered',
      note,
      proof_url: proofUrl,
      delivered_at: new Date().toISOString(),
    });

    // Transition to delivered
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

  async getDeliveryLogs(orderId: string) {
    return deliveryLogsDb.getByOrder(orderId);
  },
};
