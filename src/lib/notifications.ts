import { supabase, requireAuthUser } from './supabase';
import type { Notification } from '@/types/types';

export const createNotification = async (
  userId: string,
  message: string,
  type: Notification['type'] = 'info',
  orderId?: string
): Promise<void> => {
  await requireAuthUser();
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    message,
    type,
    read: false,
    order_id: orderId || null,
  });

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return (data || []) as Notification[];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await requireAuthUser();
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
};

export const markAllRead = async (userId: string): Promise<void> => {
  await requireAuthUser();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }

  return count || 0;
};
