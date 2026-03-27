import { supabase, requireAuthUser } from './supabase';
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
  // Activity logging is a background process, we don't necessarily want to FAIL 
  // if auth is missing for the log itself, but standard writes should be authenticated.
  // However, system logs might not have a user.
  // For the sake of standardizing, we'll try to get user, but don't strictly require for logs.
  
  try {
    // Validate and normalize user_id
    let userId = userIdInput;
    let userEmail = userEmailInput || null;

    if (!userId || userId === 'system' || userId === 'null' || userId === null) {
      userId = SYSTEM_USER_ID;
      userEmail = userEmail || SYSTEM_USER_EMAIL;
    }

    // UUID validation
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
      console.error('Supabase error:', error);
      // We don't throw here to prevent activity logging from crashing parent processes
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
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return (data || []) as ActivityLog[];
};
