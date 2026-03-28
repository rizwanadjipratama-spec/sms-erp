// ============================================================================
// WORKFLOW ENGINE — State machine for order lifecycle
// Clean, validated transitions with automatic side effects
// ============================================================================

import { requireAuthUser } from '@/lib/db';
import { requestsDb, invoicesDb, notificationsDb, profilesDb, activityLogsDb, systemLogsDb } from '@/lib/db';
import type { DbRequest, RequestStatus, UserRole, NotificationType } from '@/types/types';

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

export const WORKFLOW_STATUSES: RequestStatus[] = [
  'submitted', 'priced', 'approved', 'invoice_ready',
  'preparing', 'ready', 'on_delivery', 'delivered',
  'completed', 'issue', 'resolved', 'cancelled', 'rejected',
];

export const ACTIVE_STATUSES: RequestStatus[] = [
  'submitted', 'priced', 'approved', 'invoice_ready',
  'preparing', 'ready', 'on_delivery', 'delivered', 'issue',
];

export const TERMINAL_STATUSES: RequestStatus[] = [
  'completed', 'resolved', 'cancelled', 'rejected',
];

// Status timestamp field mapping
const STATUS_TIMESTAMP: Partial<Record<RequestStatus, string>> = {
  priced: 'priced_at',
  approved: 'approved_at',
  rejected: 'rejected_at',
  invoice_ready: 'invoice_ready_at',
  preparing: 'preparing_at',
  ready: 'ready_at',
  on_delivery: 'on_delivery_at',
  delivered: 'delivered_at',
  completed: 'completed_at',
  cancelled: 'cancelled_at',
};

// Which roles can perform which transitions
const TRANSITION_MAP: Record<UserRole, Partial<Record<RequestStatus, RequestStatus[]>>> = {
  client: {
    submitted: ['cancelled'],
    priced: ['cancelled'],
    approved: ['cancelled'],
    delivered: ['completed', 'issue'],
  },
  marketing: {
    submitted: ['priced'],
  },
  boss: {
    priced: ['approved', 'rejected'],
  },
  finance: {
    approved: ['invoice_ready'],
  },
  warehouse: {
    invoice_ready: ['preparing'],
    preparing: ['ready'],
  },
  technician: {
    ready: ['on_delivery'],
    on_delivery: ['delivered'],
  },
  admin: {
    issue: ['resolved'],
    delivered: ['resolved', 'completed'],
  },
  owner: {},
  tax: {},
};

// Who to notify on each status change
const STATUS_NOTIFY_ROLES: Partial<Record<RequestStatus, UserRole[]>> = {
  submitted: ['marketing'],
  priced: ['boss'],
  approved: ['finance'],
  invoice_ready: ['warehouse'],
  ready: ['technician'],
  completed: ['owner'],
  issue: ['admin'],
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  priced: 'Priced',
  approved: 'Approved',
  invoice_ready: 'Invoice Ready',
  preparing: 'Preparing',
  ready: 'Ready',
  on_delivery: 'On Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  issue: 'Issue',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  priced: 'bg-blue-100 text-blue-700',
  approved: 'bg-indigo-100 text-indigo-700',
  invoice_ready: 'bg-purple-100 text-purple-700',
  preparing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-orange-100 text-orange-700',
  on_delivery: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-teal-100 text-teal-700',
  completed: 'bg-green-100 text-green-700',
  issue: 'bg-red-100 text-red-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-600',
};

// ============================================================================
// TRANSITION INPUT
// ============================================================================

export interface TransitionInput {
  request: DbRequest;
  actorId: string;
  actorEmail?: string;
  actorRole: UserRole;
  nextStatus: RequestStatus;
  message: string;
  action: string;
  type?: NotificationType;
  notifyRequester?: boolean;
  notifyRoles?: UserRole[];
  notifyUserIds?: string[];
  extraUpdates?: Partial<DbRequest>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateTransition(input: TransitionInput): void {
  const { actorRole, request, nextStatus, extraUpdates } = input;
  const roleMap = TRANSITION_MAP[actorRole];

  if (!roleMap) {
    throw new Error(`Unknown role: ${actorRole}`);
  }

  const allowed = roleMap[request.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Role "${actorRole}" cannot transition from "${request.status}" to "${nextStatus}"`
    );
  }

  // Business rules
  if (nextStatus === 'priced') {
    const totalPrice = extraUpdates?.total_price ?? request.total_price ?? 0;
    if (totalPrice <= 0) {
      throw new Error('Total price must be set before marking as priced');
    }
  }

  if (nextStatus === 'rejected' && !extraUpdates?.rejection_reason && !input.metadata?.rejection_reason) {
    throw new Error('Rejection reason is required');
  }
}

// ============================================================================
// SIDE EFFECTS
// ============================================================================

async function runSideEffects(input: TransitionInput, updatedRequest: DbRequest): Promise<void> {
  const { nextStatus, actorId, actorEmail, actorRole, message } = input;

  // 1. Auto-create invoice when transitioning to invoice_ready
  if (nextStatus === 'invoice_ready') {
    const existingCount = await invoicesDb.countByOrder(updatedRequest.id);
    if (existingCount === 0) {
      const invoiceNumber = await invoicesDb.generateNumber();
      const subtotal = updatedRequest.total_price;
      const taxRate = 0.11;
      const taxAmount = Math.round(subtotal * taxRate);
      const total = subtotal + taxAmount;

      const invoice = await invoicesDb.create({
        order_id: updatedRequest.id,
        invoice_number: invoiceNumber,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        status: 'issued',
        issued_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_by: actorId,
      });

      // Link invoice to request
      await requestsDb.update(updatedRequest.id, { invoice_id: invoice.id });
    }
  }

  // 2. Consume stock when preparing
  if (nextStatus === 'preparing') {
    // Delegated to inventory-service to avoid circular imports
    // The caller (warehouse page) handles stock consumption separately
  }

  // 3. Send notifications
  const rolesToNotify = input.notifyRoles?.length
    ? input.notifyRoles
    : STATUS_NOTIFY_ROLES[nextStatus] ?? [];

  const recipientIds = new Set<string>(input.notifyUserIds?.filter(Boolean) ?? []);

  // Always notify the requester for delivery-related statuses
  const notifyRequester = input.notifyRequester ?? ['delivered', 'completed', 'issue', 'resolved', 'rejected', 'cancelled'].includes(nextStatus);
  if (notifyRequester && updatedRequest.user_id) {
    recipientIds.add(updatedRequest.user_id);
  }

  // Get staff profiles for notification
  if (rolesToNotify.length) {
    const profiles = await profilesDb.getByRoles(rolesToNotify);
    profiles.forEach(p => { if (p.id) recipientIds.add(p.id); });
  }

  // Remove actor from recipients (don't notify yourself)
  recipientIds.delete(actorId);

  if (recipientIds.size > 0) {
    await notificationsDb.createMany(
      [...recipientIds].map(userId => ({
        user_id: userId,
        title: `Order ${STATUS_LABELS[nextStatus]}`,
        message,
        type: input.type ?? 'info',
        order_id: updatedRequest.id,
        action_url: `/dashboard`,
      }))
    );
  }

  // 4. Log activity
  await activityLogsDb.create({
    user_id: actorId,
    user_email: actorEmail,
    action: input.action,
    entity_type: 'request',
    entity_id: updatedRequest.id,
    metadata: {
      previous_status: input.request.status,
      next_status: nextStatus,
      ...input.metadata,
    },
  });
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

export const workflowEngine = {
  async transition(input: TransitionInput): Promise<DbRequest> {
    await requireAuthUser();

    if (!input.actorRole) {
      throw new Error('Actor role is required for workflow transition');
    }

    const startedAt = Date.now();

    try {
      // Validate
      validateTransition(input);

      const now = new Date().toISOString();

      // Build update payload
      const timestampField = STATUS_TIMESTAMP[input.nextStatus];
      const updates: Partial<DbRequest> = {
        ...(input.extraUpdates ?? {}),
        status: input.nextStatus,
        updated_at: now,
        updated_by: input.actorId,
      };

      if (timestampField) {
        (updates as Record<string, unknown>)[timestampField] = now;
      }

      // Execute transition
      const updatedRequest = await requestsDb.update(input.request.id, updates);

      // Side effects (non-blocking for primary operation)
      try {
        await runSideEffects(input, updatedRequest);
      } catch (sideEffectError) {
        // Log but don't fail the transition
        await systemLogsDb.create({
          level: 'warning',
          service: 'workflow-engine',
          action: 'side_effect_failure',
          message: sideEffectError instanceof Error ? sideEffectError.message : 'Unknown side effect error',
          metadata: {
            request_id: updatedRequest.id,
            next_status: input.nextStatus,
          },
        });
      }

      // Log success
      await systemLogsDb.create({
        level: 'info',
        service: 'workflow-engine',
        action: 'transition_success',
        message: `${input.request.status} → ${input.nextStatus}`,
        metadata: {
          request_id: updatedRequest.id,
          actor_id: input.actorId,
          duration_ms: Date.now() - startedAt,
        },
      });

      return updatedRequest;
    } catch (error) {
      await systemLogsDb.create({
        level: 'error',
        service: 'workflow-engine',
        action: 'transition_failure',
        message: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          request_id: input.request.id,
          from_status: input.request.status,
          to_status: input.nextStatus,
          actor_id: input.actorId,
          duration_ms: Date.now() - startedAt,
        },
      });
      throw error;
    }
  },

  canTransition(role: UserRole, currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
    const roleMap = TRANSITION_MAP[role];
    if (!roleMap) return false;
    const allowed = roleMap[currentStatus] ?? [];
    return allowed.includes(nextStatus);
  },

  getAvailableTransitions(role: UserRole, currentStatus: RequestStatus): RequestStatus[] {
    const roleMap = TRANSITION_MAP[role];
    if (!roleMap) return [];
    return roleMap[currentStatus] ?? [];
  },

  TRANSITION_MAP,
};
