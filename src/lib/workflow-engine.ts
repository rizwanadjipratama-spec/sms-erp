import { supabase } from './supabase';
import { createNotificationsForUsers, fetchProfilesByRoles } from './workflow';
import { logActivity } from './activity';
import { inventoryService } from './inventory-service';
import { handleServiceError, logServiceExecution } from './service-utils';
import type { DbRequest, Notification, RequestStatus, UserRole } from '@/types/types';
import { canTransition, PERMISSIONS } from './permissions';

export const WORKFLOW_STATUSES: RequestStatus[] = [
  'submitted',
  'pending',
  'priced',
  'approved',
  'rejected',
  'invoice_ready',
  'preparing',
  'ready',
  'on_delivery',
  'delivered',
  'completed',
  'issue',
  'resolved',
  'cancelled',
];

export const WORKFLOW_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ['pending', 'cancelled'],
  pending: ['priced', 'cancelled'],
  priced: ['approved', 'rejected', 'cancelled'],
  approved: ['invoice_ready', 'cancelled'],
  rejected: [],
  invoice_ready: ['preparing'],
  preparing: ['ready'],
  ready: ['on_delivery'],
  on_delivery: ['delivered'],
  delivered: ['completed', 'issue'],
  completed: [],
  issue: ['resolved'],
  resolved: [],
  cancelled: [],
};

export type TransitionOrderInput = {
  request: DbRequest;
  actorId: string;
  actorEmail?: string;
  actorRole: UserRole;
  nextStatus: RequestStatus;
  message: string;
  action: string;
  type?: Notification['type'];
  notifyRequester?: boolean;
  notifyRoles?: UserRole[];
  notifyUserIds?: string[];
  extraUpdates?: Partial<DbRequest>;
  metadata?: Record<string, unknown>;
};

function validateTransition(input: TransitionOrderInput) {
  const currentStatus = String(input.request.status).toLowerCase().trim();
  const nextStatus = String(input.nextStatus).toLowerCase().trim();
  const key = `${currentStatus}->${nextStatus}`;

  console.log('WORKFLOW DEBUG');
  console.log('ROLE:', input.actorRole);
  console.log('CURRENT:', currentStatus);
  console.log('NEXT:', nextStatus);
  console.log('KEY:', key);

  const allowed = WORKFLOW_TRANSITIONS[input.request.status] || [];
  if (!allowed.includes(input.nextStatus)) {
    throw new Error(`Invalid transition: ${input.request.status} -> ${input.nextStatus}`);
  }

  const rolePermissions = PERMISSIONS[input.actorRole];

  if (!rolePermissions) {
    throw new Error(`Unknown role: ${input.actorRole}`);
  }

  const allowedTransitions = rolePermissions.workflowTransitions || [];

  if (!allowedTransitions.includes(key as any)) {
    console.log('ALLOWED:', allowedTransitions);
    throw new Error(`role ${input.actorRole} cannot change request workflow`);
  }


  if (input.nextStatus === 'rejected' && !input.extraUpdates?.rejection_reason) {
    throw new Error('Rejection reason is required');
  }

  if (input.nextStatus === 'priced') {
    if (!input.extraUpdates?.marketing_note && !input.request.marketing_note) {
      throw new Error('Marketing note is required before marking a request as priced');
    }
    const priceTotal = input.extraUpdates?.price_total ?? input.request.price_total ?? 0;
    if (priceTotal <= 0) {
      throw new Error('Price total must be set before marking a request as priced');
    }
  }

  if (input.nextStatus === 'invoice_ready') {
    const invoiceNumber = input.metadata?.invoice_number;
    if (!invoiceNumber) {
      throw new Error('Invoice must exist before marking invoice_ready');
    }
  }

  if (input.nextStatus === 'on_delivery') {
    const assignedId = input.extraUpdates?.assigned_technician_id || input.request.assigned_technician_id;
    if (!assignedId) {
      throw new Error('Assigned technician is required before starting delivery');
    }
    if (input.actorRole === 'technician' && assignedId !== input.actorId) {
      throw new Error('Technician can only start delivery for their own assignment');
    }
  }

  if (input.nextStatus === 'delivered') {
    const assignedId = input.extraUpdates?.assigned_technician_id || input.request.assigned_technician_id;
    if (!assignedId) {
      throw new Error('Assigned technician is required before completing delivery');
    }
    if (input.actorRole === 'technician' && assignedId !== input.actorId) {
      throw new Error('Only the assigned technician can complete delivery');
    }
  }
}

async function ensureInvoiceExists(requestId: string) {
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', requestId);

  if (error) throw new Error(error.message);
  if (!count) throw new Error('Invoice record not found');
}

async function collectNotificationRecipients(input: TransitionOrderInput) {
  const ids = new Set<string>(input.notifyUserIds?.filter(Boolean) || []);

  if (input.notifyRequester !== false && input.request.user_id) {
    ids.add(input.request.user_id);
  }

  if (input.notifyRoles?.length) {
    const profiles = await fetchProfilesByRoles(input.notifyRoles);
    profiles.forEach((profile) => {
      if (profile.id) ids.add(profile.id);
    });
  }

  return [...ids];
}

async function appendTransitionLog(
  request: DbRequest,
  input: TransitionOrderInput,
  nowIso: string
) {
  await logActivity(
    input.actorId,
    input.action,
    'request',
    request.id,
    {
      previous_status: input.request.status,
      next_status: input.nextStatus,
      request_user_id: request.user_id || null,
      request_user_email: request.user_email || null,
      changed_at: nowIso,
      ...(input.metadata || {}),
      updates: input.extraUpdates || {},
    },
    input.actorEmail
  );
}

export const workflowEngine = {
  async transitionOrder(input: TransitionOrderInput): Promise<DbRequest> {
    const startedAt = Date.now();

    // DEBUG & ROLE VALIDATION
if (!input.actorRole) {
  throw new Error('Actor role is missing in workflow transition');
}

console.log('=== WORKFLOW TRANSITION ===');
console.log('Actor:', input.actorId);
console.log('Role:', input.actorRole);
console.log('From:', input.request.status);
console.log('To:', input.nextStatus);

    console.log('TRANSITION ROLE RECEIVED:', input.actorRole);

    const logContext = {
      requestId: input.request.id,
      previousStatus: input.request.status,
      nextStatus: input.nextStatus,
      actorId: input.actorId,
      actorRole: input.actorRole,
    };

    await logServiceExecution({
      service: 'workflow-engine',
      action: 'transitionOrder',
      stage: 'start',
      startedAt,
      metadata: logContext,
    });

    try {
      validateTransition(input);

      if (input.nextStatus === 'invoice_ready') {
        await ensureInvoiceExists(input.request.id);
      }

      const nowIso = new Date().toISOString();
      const statusTimestamps: Record<RequestStatus, Record<string, string>> = {
        pending: {},
        priced: { priced_at: nowIso },
        approved: { approved_at: nowIso },
        rejected: { rejected_at: nowIso },
        invoice_ready: { invoice_ready_at: nowIso },
        preparing: { preparing_at: nowIso },
        ready: { ready_at: nowIso },
        on_delivery: { on_delivery_at: nowIso },
        delivered: { delivered_at: nowIso },
        completed: { completed_at: nowIso },
        issue: { issue_at: nowIso },
        resolved: { resolved_at: nowIso },
        cancelled: { cancelled_at: nowIso },
        submitted: { submitted_at: nowIso },
      };

      const updates = {
        ...(input.extraUpdates || {}),
        ...statusTimestamps[input.nextStatus],
        status: input.nextStatus,
      };

      const { data, error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', input.request.id)
        .eq('status', input.request.status)
        .select('*')
        .single();

      if (error) {
        throw new Error(error.message || 'Request transition failed');
      }

      const updatedRequest = data as DbRequest;

      try {
        if (input.nextStatus === 'preparing') {
          await inventoryService.consumeStockForPreparing({
            request: updatedRequest,
            actor: {
              id: input.actorId,
              email: input.actorEmail,
              role: input.actorRole,
            },
          });
        }

        // Part 6: Automate Notification Mapping
        const statusNotifyRoles: Record<string, UserRole[]> = {
          pending: ['marketing'],
          priced: ['boss'],
          approved: ['finance'],
          invoice_ready: ['warehouse'],
          ready: ['technician'],
          delivered: [], // Notify client specifically
          completed: ['owner'],
        };

        const rolesToNotify = input.notifyRoles?.length 
          ? input.notifyRoles 
          : statusNotifyRoles[input.nextStatus] || [];

        const isDelivered = input.nextStatus === 'delivered';
        const recipients = await collectNotificationRecipients({
          ...input,
          notifyRoles: rolesToNotify as UserRole[],
          notifyRequester: input.notifyRequester ?? isDelivered
        });
        
        await Promise.all([
          createNotificationsForUsers(recipients, input.message, input.type || 'info', updatedRequest.id),
          appendTransitionLog(updatedRequest, input, nowIso),
        ]);
      } catch (sideEffectError) {
        if (input.nextStatus === 'preparing') {
          await supabase
            .from('requests')
            .update({ status: input.request.status, preparing_at: null })
            .eq('id', input.request.id)
            .eq('status', input.nextStatus);
        }

        throw sideEffectError instanceof Error
          ? sideEffectError
          : new Error('Workflow side effects failed');
      }

      await logServiceExecution({
        service: 'workflow-engine',
        action: 'transitionOrder',
        stage: 'success',
        startedAt,
        metadata: logContext,
      });

      return updatedRequest;
    } catch (error) {
      await logServiceExecution({
        service: 'workflow-engine',
        action: 'transitionOrder',
        stage: 'failure',
        startedAt,
        metadata: {
          ...logContext,
          error: error instanceof Error ? error.message : 'Unknown workflow error',
        },
      });
      throw handleServiceError('workflow-engine', 'transitionOrder', error, logContext);
    }
  },
};
