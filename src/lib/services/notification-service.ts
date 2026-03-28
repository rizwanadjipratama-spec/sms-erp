// ============================================================================
// NOTIFICATION SERVICE — Real-time notifications with bell counter
// ============================================================================

import { notificationsDb, profilesDb } from '@/lib/db';
import { supabase } from '@/lib/db';
import type { Notification, NotificationType, UserRole, PaginationParams } from '@/types/types';

export const notificationService = {
  async getForUser(userId: string, pagination?: PaginationParams) {
    return notificationsDb.getByUser(userId, pagination);
  },

  async getUnreadCount(userId: string): Promise<number> {
    return notificationsDb.getUnreadCount(userId);
  },

  async markRead(notificationId: string, userId: string): Promise<void> {
    await notificationsDb.markRead(notificationId, userId);
  },

  async markAllRead(userId: string): Promise<void> {
    await notificationsDb.markAllRead(userId);
  },

  async notifyUser(userId: string, params: {
    title?: string;
    message: string;
    type?: NotificationType;
    orderId?: string;
    actionUrl?: string;
  }): Promise<void> {
    await notificationsDb.create({
      user_id: userId,
      title: params.title,
      message: params.message,
      type: params.type ?? 'info',
      order_id: params.orderId,
      action_url: params.actionUrl,
    });
  },

  async notifyRoles(roles: UserRole[], params: {
    title?: string;
    message: string;
    type?: NotificationType;
    orderId?: string;
    actionUrl?: string;
  }): Promise<void> {
    const profiles = await profilesDb.getByRoles(roles);
    if (!profiles.length) return;

    await notificationsDb.createMany(
      profiles.map(p => ({
        user_id: p.id!,
        title: params.title,
        message: params.message,
        type: params.type ?? 'info',
        order_id: params.orderId,
        action_url: params.actionUrl,
      }))
    );
  },

  subscribeToNotifications(userId: string, onNotification: (n: Notification) => void) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotification(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
