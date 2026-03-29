// ============================================================================
// PERMISSIONS — Role-Based Access Control
// ============================================================================

import type { RequestStatus, UserRole } from '@/types/types';

export type AppRoute =
  | '/dashboard'
  | '/dashboard/client'
  | '/dashboard/client/issues'
  | '/dashboard/client/products'
  | '/dashboard/client/setup'
  | '/dashboard/marketing'
  | '/dashboard/marketing/prices'
  | '/dashboard/marketing/clients'
  | '/dashboard/boss'
  | '/dashboard/finance'
  | '/dashboard/warehouse'
  | '/dashboard/technician'
  | '/dashboard/admin'
  | '/dashboard/owner'
  | '/dashboard/owner/reports'
  | '/dashboard/tax'
  | '/dashboard/notifications'
  | '/request';

export type EntityScope =
  | 'profiles:self' | 'profiles:all'
  | 'products:catalog' | 'products:all'
  | 'price_list:catalog' | 'price_list:all'
  | 'requests:own' | 'requests:pending' | 'requests:priced' | 'requests:approved'
  | 'requests:invoice_ready' | 'requests:warehouse' | 'requests:technician'
  | 'requests:issue' | 'requests:all'
  | 'invoices:finance' | 'invoices:reporting'
  | 'inventory_logs:warehouse' | 'inventory_logs:all'
  | 'delivery_logs:technician' | 'delivery_logs:all'
  | 'issues:own' | 'issues:admin'
  | 'notifications:own'
  | 'activity_logs:request' | 'activity_logs:all'
  | 'monthly_closing:finance' | 'monthly_closing:owner'
  | 'payment_promises:own'
  | 'chat:staff'
  | 'cms:admin';

export type RolePermission = {
  routes: AppRoute[];
  readableEntities: EntityScope[];
  writableEntities: EntityScope[];
};

export const PERMISSIONS: Record<UserRole, RolePermission> = {
  client: {
    routes: ['/dashboard', '/dashboard/client', '/dashboard/client/setup', '/dashboard/client/issues', '/dashboard/client/products', '/dashboard/notifications', '/request'],
    readableEntities: ['profiles:self', 'products:catalog', 'price_list:catalog', 'requests:own', 'issues:own', 'notifications:own', 'payment_promises:own'],
    writableEntities: ['requests:own', 'issues:own', 'payment_promises:own', 'notifications:own'],
  },
  marketing: {
    routes: ['/dashboard', '/dashboard/marketing', '/dashboard/marketing/clients', '/dashboard/marketing/prices', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'products:catalog', 'products:all', 'price_list:all', 'requests:pending', 'notifications:own', 'chat:staff'],
    writableEntities: ['price_list:all', 'requests:pending', 'products:all', 'notifications:own'],
  },
  boss: {
    routes: ['/dashboard', '/dashboard/boss', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:priced', 'requests:all', 'notifications:own', 'chat:staff'],
    writableEntities: ['requests:priced', 'notifications:own'],
  },
  finance: {
    routes: ['/dashboard', '/dashboard/finance', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:approved', 'invoices:finance', 'monthly_closing:finance', 'notifications:own', 'activity_logs:request', 'chat:staff'],
    writableEntities: ['requests:approved', 'invoices:finance', 'monthly_closing:finance', 'notifications:own'],
  },
  warehouse: {
    routes: ['/dashboard', '/dashboard/warehouse', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:warehouse', 'products:all', 'inventory_logs:warehouse', 'notifications:own', 'chat:staff'],
    writableEntities: ['requests:warehouse', 'products:all', 'inventory_logs:warehouse', 'notifications:own'],
  },
  technician: {
    routes: ['/dashboard', '/dashboard/technician', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'requests:technician', 'delivery_logs:technician', 'notifications:own', 'chat:staff'],
    writableEntities: ['requests:technician', 'delivery_logs:technician', 'notifications:own'],
  },
  admin: {
    routes: ['/dashboard', '/dashboard/admin', '/dashboard/notifications'],
    readableEntities: ['profiles:all', 'products:all', 'requests:all', 'issues:admin', 'inventory_logs:all', 'delivery_logs:all', 'notifications:own', 'activity_logs:all', 'chat:staff', 'cms:admin'],
    writableEntities: ['profiles:all', 'products:all', 'requests:issue', 'issues:admin', 'inventory_logs:all', 'notifications:own', 'cms:admin'],
  },
  owner: {
    routes: ['/dashboard', '/dashboard/owner', '/dashboard/owner/reports', '/dashboard/notifications'],
    readableEntities: ['profiles:all', 'products:all', 'price_list:all', 'requests:all', 'invoices:reporting', 'inventory_logs:all', 'delivery_logs:all', 'issues:admin', 'notifications:own', 'activity_logs:all', 'monthly_closing:owner', 'chat:staff', 'cms:admin'],
    writableEntities: ['notifications:own', 'cms:admin'],
  },
  tax: {
    routes: ['/dashboard', '/dashboard/tax', '/dashboard/notifications'],
    readableEntities: ['profiles:self', 'invoices:reporting', 'monthly_closing:owner', 'notifications:own', 'chat:staff'],
    writableEntities: ['notifications:own'],
  },
};

export function getRolePermissions(role?: UserRole | null): RolePermission | null {
  if (!role) return null;
  return PERMISSIONS[role] ?? null;
}

export function canAccessRoute(role: UserRole | undefined | null, route: string): boolean {
  const p = getRolePermissions(role);
  if (!p) return false;
  return p.routes.includes(route as AppRoute);
}

export function canReadEntity(role: UserRole | undefined | null, entity: EntityScope): boolean {
  const p = getRolePermissions(role);
  if (!p) return false;
  return p.readableEntities.includes(entity);
}

export function canWriteEntity(role: UserRole | undefined | null, entity: EntityScope): boolean {
  const p = getRolePermissions(role);
  if (!p) return false;
  return p.writableEntities.includes(entity);
}
