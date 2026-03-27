import { supabase } from './supabase';
import { logActivity } from './activity';
import type { CartItem, ClientType, DbRequest, Notification, Profile, RequestStatus, UserRole } from '@/types/types';

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  client: '/dashboard/client',
  user: '/dashboard/client',
  marketing: '/dashboard/marketing',
  boss: '/dashboard/boss',
  finance: '/dashboard/finance',
  warehouse: '/dashboard/warehouse',
  technician: '/dashboard/technician',
  admin: '/dashboard/admin',
  owner: '/dashboard/owner',
  tax: '/dashboard/tax',
};

export const ORDER_STATUS_FLOW: RequestStatus[] = [
  'pending',
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
  'rejected',
];

export const ACTIVE_ORDER_STATUSES: RequestStatus[] = [
  'pending',
  'priced',
  'approved',
  'invoice_ready',
  'preparing',
  'ready',
  'on_delivery',
  'delivered',
  'issue',
];

export async function getCurrentAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('User not authenticated');
  return data.user;
}

export async function fetchProfilesByRoles(roles: UserRole[]): Promise<Profile[]> {
  const uniqueRoles = [...new Set(roles)];
  if (uniqueRoles.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', uniqueRoles);

  if (error) throw new Error(error.message);
  return (data || []) as Profile[];
}

export async function fetchProfilesByEmails(emails: string[]): Promise<Profile[]> {
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  if (uniqueEmails.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('email', uniqueEmails);

  if (error) throw new Error(error.message);
  return (data || []) as Profile[];
}

export async function calculatePriceTotal(
  items: CartItem[],
  clientType: ClientType
): Promise<number> {
  const uniqueIds = [...new Set(items.map((item) => item.id))];
  if (uniqueIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('price_list')
    .select('product_id, price_regular, price_kso')
    .in('product_id', uniqueIds);

  if (error) throw new Error(error.message);

  const priceMap = new Map<string, { regular: number; kso: number }>();
  (data || []).forEach((row: { product_id: string; price_regular: number; price_kso: number }) => {
    priceMap.set(row.product_id, { regular: row.price_regular, kso: row.price_kso });
  });

  return items.reduce((sum, item) => {
    const prices = priceMap.get(item.id);
    if (!prices) return sum;
    const unitPrice = clientType === 'kso' ? prices.kso : prices.regular;
    return sum + unitPrice * item.qty;
  }, 0);
}

export async function createNotificationsForUsers(
  userIds: string[],
  message: string,
  type: Notification['type'] = 'info',
  orderId?: string
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  const rows = uniqueUserIds.map((userId) => ({
    user_id: userId,
    message,
    type,
    read: false,
    order_id: orderId || null,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('Notification insert failed:', error.message);
}

type OrderEventOptions = {
  actorId: string;
  actorEmail?: string;
  action: string;
  message: string;
  type?: Notification['type'];
  notifyRequester?: boolean;
  notifyRoles?: UserRole[];
  notifyUserIds?: string[];
  metadata?: Record<string, unknown>;
};

export async function recordOrderEvent(
  request: Pick<DbRequest, 'id' | 'user_id' | 'user_email' | 'status'>,
  options: OrderEventOptions
): Promise<void> {
  const ids = new Set<string>(options.notifyUserIds?.filter(Boolean) || []);

  if (options.notifyRequester !== false && request.user_id) {
    ids.add(request.user_id);
  }

  if (options.notifyRoles?.length) {
    try {
      const profiles = await fetchProfilesByRoles(options.notifyRoles);
      profiles.forEach((profile) => {
        if (profile.id) ids.add(profile.id);
      });
    } catch (error) {
      console.error('Role notification lookup failed:', error);
    }
  }

  await Promise.all([
    createNotificationsForUsers([...ids], options.message, options.type || 'info', request.id),
    logActivity(
      options.actorId,
      options.action,
      'request',
      request.id,
      {
        status: request.status,
        request_user_id: request.user_id || null,
        request_user_email: request.user_email || null,
        ...(options.metadata || {}),
      },
      options.actorEmail
    ),
  ]);
}
