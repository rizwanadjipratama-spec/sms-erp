import { supabase, requireAuthUser } from './supabase';
import { createNotificationsForUsers, fetchProfilesByRoles } from './workflow';
import { logActivity } from './activity';
import { inventoryService } from './inventory-service';
import { handleServiceError, logServiceExecution } from './service-utils';
import type { DbRequest, Notification, RequestStatus, UserRole } from '@/types/types';
import { canTransition, PERMISSIONS } from './permissions';

export const WORKFLOW_STATUSES: RequestStatus[] = [
  'submitted',
  'priced',
  'approved',
  'invoice_ready',
  'preparing',
  'ready',
  'on_delivery',
  'delivered',
  'completed',
  'issue',
  'resolved',
  'cancelled',
  'rejected',
];

export const WORKFLOW_ROLE_TRANSITIONS: Record<UserRole, Partial<Record<RequestStatus, RequestStatus[]>>> = {
  client: {
    submitted: ['cancelled'],
    priced: ['cancelled'],
    delivered: ['completed'],
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
  user: {
    delivered: ['completed'],
  },
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
  const roleMap = WORKFLOW_ROLE_TRANSITIONS[input.actorRole];

  if (!roleMap) {
    throw new Error(`Unknown role: ${input.actorRole}`);
  }

  const allowedNextStatuses = roleMap[input.request.status] || [];

  if (!allowedNextStatuses.includes(input.nextStatus)) {
    throw new Error(`role ${input.actorRole} cannot change request workflow from ${input.request.status} to ${input.nextStatus}`);
  }

  if (input.nextStatus === 'priced') {
    if (!input.extraUpdates?.note && !input.request.note) {
      throw new Error('Pricing note is required before marking as priced');
    }
    const totalPrice = input.extraUpdates?.total_price ?? input.request.total_price ?? 0;
    if (totalPrice <= 0) {
      throw new Error('Total price must be set before marking as priced');
    }
  }
}

async function ensureInvoiceExists(requestId: string) {
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', requestId);

  if (error) {
    console.error('Supabase error full object:', JSON.stringify(error, null, 2));
    throw new Error(error?.message || 'Invoice check failed');
  }
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
    await requireAuthUser();
    const startedAt = Date.now();

    if (!input.actorRole) {
      throw new Error('Actor role is missing in workflow transition');
    }

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

      const nowIso = new Date().toISOString();
      
      const updates = {
        ...(input.extraUpdates || {}),
        status: input.nextStatus,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', input.request.id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase error full object:', JSON.stringify(error, null, 2));
        throw new Error(error?.message || 'Database update failed');
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

        if (input.nextStatus === 'invoice_ready') {
          const { count } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', updatedRequest.id);
          
          if (!count) {
             const { financeService } = await import('./finance-service');
             await financeService.createInvoiceForRequest({
               request: updatedRequest,
               actor: {
                 id: input.actorId,
                 email: input.actorEmail,
                 role: input.actorRole,
               },
             });
          }
        }

        // Notification Mapping
        const statusNotifyRoles: Partial<Record<RequestStatus, UserRole[]>> = {
          submitted: ['marketing'],
          priced: ['boss'],
          approved: ['finance'],
          invoice_ready: ['warehouse'],
          ready: ['technician'],
          delivered: [], // Notify client
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
        console.error('Side effect failure:', sideEffectError);
        // Status changed but side effects failed. We should log this but not necessarily revert the primary status change
        // to avoid stuck states if the failure is in a secondary system.
      }

      return updatedRequest;
    } catch (error) {
      console.error('Workflow transition error:', error);
      await logServiceExecution({
        service: 'workflow-engine',
        action: 'transitionOrder',
        stage: 'failure',
        startedAt,
        metadata: {
          ...logContext,
          error: error instanceof Error ? error.message : 'Unknown workflow error',
          fullError: JSON.stringify(error, null, 2),
        },
      });
      throw error;
    }
  },

  async confirmCompleted(input: { 
    request: DbRequest; 
    actorId: string; 
    actorEmail?: string; 
    actorRole: UserRole 
  }): Promise<DbRequest> {
    return this.transitionOrder({
      ...input,
      nextStatus: 'completed',
      action: 'complete_request',
      message: `Request ${input.request.id} confirmed completed by client`,
      notifyRoles: ['admin', 'owner'],
      type: 'success'
    });
  }
};
