import { logActivity } from './activity';
import { createNotificationsForUsers, fetchProfilesByRoles } from './workflow';
import { supabase } from './supabase';
import type { AutomationEvent, UserRole } from '@/types/types';

export const SYSTEM_EVENTS = [
  'request_created',
  'request_priced',
  'request_approved',
  'request_rejected',
  'invoice_created',
  'invoice_paid',
  'invoice_overdue',
  'order_preparing',
  'order_ready',
  'order_on_delivery',
  'order_delivered',
  'order_completed',
  'issue_created',
  'issue_resolved',
  'monthly_closing_created',
  'low_stock_warning',
] as const;

export type SystemEventType = (typeof SYSTEM_EVENTS)[number];

export type SystemEventPayload = Record<string, unknown> & {
  orderId?: string;
  entityId?: string;
  entityType?: string;
  notificationUserIds?: string[];
  notificationRoles?: UserRole[];
  message?: string;
  actorId?: string;
  actorEmail?: string;
};

export type SystemEvent<TPayload = SystemEventPayload> = {
  type: SystemEventType;
  emittedAt: string;
  payload: TPayload;
};

async function resolveNotificationRecipients(payload: SystemEventPayload) {
  const ids = new Set<string>(payload.notificationUserIds?.filter(Boolean) || []);

  if (payload.notificationRoles?.length) {
    try {
      const profiles = await fetchProfilesByRoles(payload.notificationRoles);
      profiles.forEach((profile) => {
        if (profile.id) ids.add(profile.id);
      });
    } catch (error) {
      console.error('Automation role recipient lookup failed:', error);
    }
  }

  if (ids.size === 0) {
    try {
      const fallbackProfiles = await fetchProfilesByRoles(['admin', 'owner']);
      fallbackProfiles.forEach((profile) => {
        if (profile.id) ids.add(profile.id);
      });
    } catch (error) {
      console.error('Automation fallback recipient lookup failed:', error);
    }
  }

  return [...ids];
}

export async function emitSystemEvent<TPayload extends SystemEventPayload>(
  eventType: SystemEventType,
  payload: TPayload
): Promise<SystemEvent<TPayload> & { row?: AutomationEvent }> {
  const emittedAt = new Date().toISOString();
  const event = {
    type: eventType,
    emittedAt,
    payload,
  };

  const { data, error } = await supabase
    .from('automation_events')
    .insert({
      event_type: eventType,
      payload,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Automation event insert failed:', error.message);
  }

  try {
    const recipients = await resolveNotificationRecipients(payload);
    if (recipients.length > 0) {
      await createNotificationsForUsers(
        recipients,
        payload.message || `Automation event: ${eventType}`,
        'info',
        payload.orderId
      );
    }
  } catch (notificationError) {
    console.error('Automation event notification failed:', notificationError);
  }

  try {
    const { data: authData } = await supabase.auth.getUser();
    const actorId = payload.actorId || authData.user?.id;
    if (actorId) {
      await logActivity(
        actorId,
        'automation_event_emitted',
        payload.entityType || 'automation_event',
        payload.entityId || (data?.id as string | undefined),
        {
          event_type: eventType,
          payload,
          automation_event_id: data?.id || null,
        },
        payload.actorEmail || authData.user?.email || undefined
      );
    }
  } catch (activityError) {
    console.error('Automation event activity log failed:', activityError);
  }

  console.info('[system-event]', event);
  return {
    ...event,
    row: (data || undefined) as AutomationEvent | undefined,
  };
}
