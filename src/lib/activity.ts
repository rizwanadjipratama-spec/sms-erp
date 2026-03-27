import { supabase } from './supabase';
import type { ActivityLog } from '@/types/types';

import { SYSTEM_USER_ID, SYSTEM_USER_EMAIL } from './constants';

export const logActivity = async (
  userIdInput: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  userEmailInput?: string
): Promise<void> => {
  try {
    // Validate and normalize user_id
    let userId = userIdInput;
    let userEmail = userEmailInput || null;

    if (!userId || userId === 'system' || userId === 'null' || userId === null) {
      userId = SYSTEM_USER_ID;
      userEmail = userEmail || SYSTEM_USER_EMAIL;
    }

    // UUID validation (loose - Supabase handles strict validation)
    if (userId !== SYSTEM_USER_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      userId = SYSTEM_USER_ID;
      userEmail = SYSTEM_USER_EMAIL;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId as string,
      user_email: userEmail,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      metadata: metadata || null,
    });

    if (error) {
      console.error('Activity log failed:', {
        error: error.message,
        userId,
        action,
        entityType,
        entityId
      });
    }
  } catch (error) {
    console.error('Activity logging crashed:', error);
  }
};

export const getActivityLogs = async (
  limit = 50,
  entityType?: string,
  entityId?: string
): Promise<ActivityLog[]> => {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);

  const { data, error } = await query;
  if (error) return [];
  return (data || []) as ActivityLog[];
};
