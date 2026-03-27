import type { RequestStatus, UserRole } from '@/types/types';

export type AppRoute =
  | '/dashboard'
  | '/dashboard/client'
  | '/dashboard/client/issues'
  | '/dashboard/marketing'
  | '/dashboard/marketing/prices'
  | '/dashboard/boss'
  | '/dashboard/finance'
  | '/dashboard/warehouse'
  | '/dashboard/technician'
  | '/dashboard/admin'
  | '/dashboard/owner'
  | '/dashboard/tax'
  | '/dashboard/notifications'
  | '/request';

export type EntityScope =
  | 'profiles:self'
  | 'profiles:all'
  | 'products:catalog'
  | 'products:all'
  | 'price_list:catalog'
  | 'price_list:all'
  | 'requests:own'
  | 'requests:pending'
  | 'requests:priced'
  | 'requests:approved'
  | 'requests:invoice_ready'
  | 'requests:warehouse'
  | 'requests:technician'
  | 'requests:issue'
  | 'requests:all'
  | 'invoices:finance'
  | 'invoices:reporting'
  | 'inventory_logs:warehouse'
  | 'inventory_logs:all'
  | 'delivery_logs:technician'
  | 'delivery_logs:all'
  | 'issues:own'
  | 'issues:admin'
  | 'notifications:own'
  | 'activity_logs:request'
  | 'activity_logs:all'
  | 'monthly_closing:finance'
  | 'monthly_closing:owner'
  | 'payment_promises:own';

export type WorkflowTransitionKey =
  | 'pending->priced'
  | 'priced->approved'
  | 'priced->rejected'
  | 'approved->invoice_ready'
  | 'invoice_ready->preparing'
  | 'preparing->ready'
  | 'ready->on_delivery'
  | 'on_delivery->delivered'
  | 'delivered->completed'
  | 'delivered->issue'
  | 'issue->resolved';

export type RolePermission = {
  routes: AppRoute[];
  readableEntities: EntityScope[];
  writableEntities: EntityScope[];
  workflowTransitions: WorkflowTransitionKey[];
};

export const PERMISSIONS: Record<UserRole, RolePermission> = {
  client: {
    routes: ['/dashboard', '/dashboard/client', '/dashboard/client/issues', '/dashboard/notifications', '/request'],
    readableEntities: ['profiles:self', 'products:catalog', 'price_list:catalog', 'requests:own', 'issues:own', 'notifications:own', 'payment_promises:own'],
    writableEntities: ['requests:own', 'issues:own', 'payment_promises:own', 'notifications:own'],
    workflowTransitions: ['delivered->completed', 'delivered->issue'],
  },
  marketing: {
    routes: ['/dashboard', '/dashboard/marketing', '/dashboard/marketing/prices', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'products:catalog', 'products:all', 'price_list:all', 'requests:pending', 'notifications:own'],
    writableEntities: ['price_list:all', 'requests:pending', 'notifications:own'],
    workflowTransitions: ['pending->priced'],
  },
  boss: {
    routes: ['/dashboard', '/dashboard/boss', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:priced', 'notifications:own'],
    writableEntities: ['requests:priced', 'notifications:own'],
    workflowTransitions: ['priced->approved', 'priced->rejected'],
  },
  finance: {
    routes: ['/dashboard', '/dashboard/finance', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:approved', 'invoices:finance', 'monthly_closing:finance', 'notifications:own', 'activity_logs:request'],
    writableEntities: ['requests:approved', 'invoices:finance', 'monthly_closing:finance', 'notifications:own'],
    workflowTransitions: ['approved->invoice_ready'],
  },
  warehouse: {
    routes: ['/dashboard', '/dashboard/warehouse', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:warehouse', 'products:all', 'inventory_logs:warehouse', 'notifications:own'],
    writableEntities: ['requests:warehouse', 'products:all', 'inventory_logs:warehouse', 'notifications:own'],
    workflowTransitions: ['invoice_ready->preparing', 'preparing->ready'],
  },
  technician: {
    routes: ['/dashboard', '/dashboard/technician', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:technician', 'delivery_logs:technician', 'notifications:own'],
    writableEntities: ['requests:technician', 'delivery_logs:technician', 'notifications:own'],
    workflowTransitions: ['ready->on_delivery', 'on_delivery->delivered'],
  },
  admin: {
    routes: ['/dashboard', '/dashboard/admin', '/dashboard/notifications'],
    readableEntities: ['profiles:all', 'products:all', 'requests:issue', 'issues:admin', 'inventory_logs:all', 'delivery_logs:all', 'notifications:own', 'activity_logs:all'],
    writableEntities: ['profiles:all', 'products:all', 'requests:issue', 'issues:admin', 'inventory_logs:all', 'notifications:own'],
    workflowTransitions: ['issue->resolved'],
  },
  owner: {
    routes: ['/dashboard', '/dashboard/owner', '/dashboard/notifications'],
    readableEntities: ['profiles:all', 'products:all', 'price_list:all', 'requests:all', 'invoices:reporting', 'inventory_logs:all', 'delivery_logs:all', 'issues:admin', 'notifications:own', 'activity_logs:all', 'monthly_closing:owner'],
    writableEntities: ['notifications:own'],
    workflowTransitions: [],
  },
  tax: {
    routes: ['/dashboard', '/dashboard/tax', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'invoices:reporting', 'monthly_closing:owner', 'notifications:own'],
    writableEntities: ['notifications:own'],
    workflowTransitions: [],
  },
  user: {
    routes: ['/dashboard', '/dashboard/client', '/dashboard/client/issues', '/dashboard/notifications', '/request'],
    readableEntities: ['profiles:self', 'products:catalog', 'price_list:catalog', 'requests:own', 'issues:own', 'notifications:own', 'payment_promises:own'],
    writableEntities: ['requests:own', 'issues:own', 'payment_promises:own', 'notifications:own'],
    workflowTransitions: ['delivered->completed', 'delivered->issue'],
  },
};

export function getRolePermissions(role?: UserRole | null): RolePermission | null {
  if (!role) return null;
  const normalizedRole = role.toLowerCase() as UserRole;
  return PERMISSIONS[normalizedRole] || null;
}


export function canAccessRoute(role: UserRole | undefined | null, route: string): boolean {
  const permissions = getRolePermissions(role);
  if (!permissions) return false;
  return permissions.routes.includes(route as AppRoute);
}

export function canReadEntity(role: UserRole | undefined | null, entity: EntityScope): boolean {
  const permissions = getRolePermissions(role);
  if (!permissions) return false;
  return permissions.readableEntities.includes(entity);
}

export function canWriteEntity(role: UserRole | undefined | null, entity: EntityScope): boolean {
  const permissions = getRolePermissions(role);
  if (!permissions) return false;
  return permissions.writableEntities.includes(entity);
}

export function getTransitionKey(current: RequestStatus, next: RequestStatus): WorkflowTransitionKey | null {
  const key = `${current}->${next}` as WorkflowTransitionKey;
  return [
    'pending->priced',
    'priced->approved',
    'priced->rejected',
    'approved->invoice_ready',
    'invoice_ready->preparing',
    'preparing->ready',
    'ready->on_delivery',
    'on_delivery->delivered',
    'delivered->completed',
    'delivered->issue',
    'issue->resolved',
  ].includes(key)
    ? key
    : null;
}

export function canTransition(
  role: UserRole | undefined | null,
  current: RequestStatus,
  next: RequestStatus
): boolean {
  if (!role) return false;

  const permissions = getRolePermissions(role);
  if (!permissions) return false;

  const key = getTransitionKey(current, next);
  if (!key) return false;

  return permissions.workflowTransitions.includes(key);
}