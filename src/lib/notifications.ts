import { supabase } from './supabase';
import type { Notification } from '@/types/types';

export const createNotification = async (
  userId: string,
  message: string,
  type: Notification['type'] = 'info',
  orderId?: string
): Promise<void> => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    message,
    type,
    read: false,
    order_id: orderId || null,
  });

  if (error) console.error('Notification insert failed:', error.message);
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return (data || []) as Notification[];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
};

export const markAllRead = async (userId: string): Promise<void> => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  return count || 0;
};
