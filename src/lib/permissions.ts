// ============================================================================
// PERMISSIONS — Role-Based Access Control
// ============================================================================

import type { RequestStatus, UserRole } from '@/types/types';

export type AppRoute =
  | '/dashboard'
  | '/dashboard/client'
  | '/dashboard/client/issues'
  | '/dashboard/client/products'
  | '/dashboard/client/equipment'
  | '/dashboard/marketing'
  | '/dashboard/marketing/prices'
  | '/dashboard/marketing/clients'
  | '/dashboard/order-approvals'
  | '/dashboard/finance'
  | '/dashboard/warehouse'
  | '/dashboard/warehouse/inventory'
  | '/dashboard/warehouse/catalog'
  | '/dashboard/delivery'
  | '/dashboard/delivery/inventory'
  | '/dashboard/courier-portal'
  | '/dashboard/admin-panel'
  | '/dashboard/owner'
  | '/dashboard/owner/reports'
  | '/dashboard/director-overview'
  | '/dashboard/tax-reports'
  | '/dashboard/faktur-tasks'
  | '/dashboard/cms'
  | '/dashboard/company'
  | '/dashboard/notifications'
  | '/dashboard/purchasing'
  | '/dashboard/approvals'
  | '/dashboard/claims'
  | '/dashboard/claims/approvals'
  | '/dashboard/claims/disbursements'
  | '/dashboard/stock'
  | '/dashboard/leave'
  | '/dashboard/leave'
  | '/dashboard/attendance'
  | '/dashboard/procurement-approvals'
  | '/dashboard/warehouse/request-purchase'
  | '/dashboard/profile'
  | '/dashboard/settings'
  | '/dashboard/users'
  | '/request';

export type EntityScope =
  | 'profiles:self' | 'profiles:all'
  | 'products:catalog' | 'products:all'
  | 'price_lists:catalog' | 'price_lists:all'
  | 'requests:own' | 'requests:pending' | 'requests:priced' | 'requests:approved'
  | 'requests:invoice_ready' | 'requests:warehouse' | 'requests:technician' | 'requests:courier'
  | 'requests:issue' | 'requests:all'
  | 'invoices:finance' | 'invoices:reporting'
  | 'inventory_logs:warehouse' | 'inventory_logs:all'
  | 'delivery_logs:technician' | 'delivery_logs:courier' | 'delivery_logs:all'
  | 'issues:own' | 'issues:admin'
  | 'service_issues:own' | 'service_issues:area' | 'service_issues:all'
  | 'technician_areas:own' | 'area_transfers:own'
  | 'equipment_assets:own' | 'equipment_assets:all'
  | 'pm_schedules:own' | 'pm_schedules:area' | 'pm_schedules:all'
  | 'faktur_tasks:own' | 'faktur_tasks:all'
  | 'notifications:own'
  | 'activity_logs:request' | 'activity_logs:all'
  | 'monthly_closing:finance' | 'monthly_closing:owner'
  | 'payment_promises:own'
  | 'chat:staff'
  | 'cms:admin'
  | 'leave_requests:all';

export type RolePermission = {
  routes: AppRoute[];
  readableEntities: EntityScope[];
  writableEntities: EntityScope[];
};

export const PERMISSIONS: Record<UserRole, RolePermission> = {
  client: {
    routes: ['/dashboard', '/dashboard/client', '/dashboard/client/issues', '/dashboard/client/products', '/dashboard/client/equipment', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings', '/request'],
    readableEntities: ['profiles:self', 'products:catalog', 'price_lists:catalog', 'requests:own', 'issues:own', 'service_issues:own', 'equipment_assets:own', 'pm_schedules:own', 'notifications:own', 'payment_promises:own'],
    writableEntities: ['requests:own', 'issues:own', 'service_issues:own', 'payment_promises:own', 'notifications:own'],
  },
  marketing: {
    routes: ['/dashboard', '/dashboard/marketing', '/dashboard/marketing/prices', '/dashboard/marketing/clients', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:all', 'products:all', 'price_lists:all', 'requests:own', 'requests:approved', 'requests:invoice_ready', 'payment_promises:own', 'notifications:own'],
    writableEntities: ['profiles:self', 'price_lists:all', 'requests:own', 'payment_promises:own', 'notifications:own'],
  },
  boss: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/approvals', '/dashboard/order-approvals', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/procurement-approvals', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings', '/dashboard/users'],
    readableEntities: ['profiles:self', 'requests:priced', 'requests:all', 'equipment_assets:all', 'pm_schedules:all', 'notifications:own', 'chat:staff'],
    writableEntities: ['requests:priced', 'notifications:own'],
  },
  finance: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/finance', '/dashboard/claims', '/dashboard/approvals', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'requests:approved', 'invoices:finance', 'faktur_tasks:all', 'monthly_closing:finance', 'notifications:own', 'activity_logs:request', 'chat:staff'],
    writableEntities: ['requests:approved', 'invoices:finance', 'faktur_tasks:all', 'monthly_closing:finance', 'notifications:own'],
  },
  warehouse: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/warehouse', '/dashboard/warehouse/inventory', '/dashboard/warehouse/catalog', '/dashboard/warehouse/request-purchase', '/dashboard/stock', '/dashboard/purchasing', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'requests:warehouse', 'products:all', 'inventory_logs:warehouse', 'equipment_assets:all', 'pm_schedules:all', 'notifications:own', 'chat:staff'],
    writableEntities: ['requests:warehouse', 'products:all', 'inventory_logs:warehouse', 'equipment_assets:all', 'notifications:own'],
  },
  technician: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/delivery', '/dashboard/delivery/inventory', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'products:all', 'requests:technician', 'delivery_logs:technician', 'service_issues:area', 'service_issues:all', 'technician_areas:own', 'area_transfers:own', 'equipment_assets:all', 'pm_schedules:area', 'pm_schedules:all', 'notifications:own', 'chat:staff'],
    writableEntities: ['products:all', 'requests:technician', 'delivery_logs:technician', 'service_issues:area', 'technician_areas:own', 'area_transfers:own', 'pm_schedules:area', 'notifications:own'],
  },
  courier: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/courier-portal', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'requests:courier', 'delivery_logs:courier', 'notifications:own', 'chat:staff'],
    writableEntities: ['requests:courier', 'delivery_logs:courier', 'notifications:own'],
  },
  admin: {
    routes: ['/dashboard', '/dashboard/admin-panel', '/dashboard/client/products', '/dashboard/marketing/clients', '/dashboard/warehouse/catalog', '/dashboard/delivery/inventory', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings', '/dashboard/users'],
    readableEntities: ['profiles:all', 'products:all', 'price_lists:all', 'requests:all', 'issues:admin', 'service_issues:all', 'equipment_assets:all', 'pm_schedules:all', 'faktur_tasks:all', 'notifications:own', 'payment_promises:own', 'monthly_closing:finance', 'chat:staff', 'leave_requests:all', 'delivery_logs:all', 'inventory_logs:all'],
    writableEntities: ['profiles:all', 'products:all', 'price_lists:all', 'requests:all', 'issues:admin', 'service_issues:all', 'equipment_assets:all', 'pm_schedules:all', 'faktur_tasks:all', 'notifications:own', 'payment_promises:own', 'monthly_closing:finance', 'chat:staff'],
  },
  owner: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/owner', '/dashboard/owner/reports', '/dashboard/cms', '/dashboard/approvals', '/dashboard/order-approvals', '/dashboard/purchasing', '/dashboard/claims', '/dashboard/claims/approvals', '/dashboard/stock', '/dashboard/warehouse/request-purchase', '/dashboard/leave', '/dashboard/attendance', '/dashboard/procurement-approvals', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings', '/dashboard/users'],
    readableEntities: ['profiles:all', 'products:all', 'price_lists:all', 'requests:all', 'invoices:reporting', 'faktur_tasks:all', 'inventory_logs:all', 'delivery_logs:all', 'issues:admin', 'notifications:own', 'activity_logs:all', 'monthly_closing:owner', 'chat:staff', 'cms:admin', 'leave_requests:all'],
    writableEntities: ['notifications:own', 'cms:admin', 'faktur_tasks:all', 'leave_requests:all'],
  },
  director: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/director-overview', '/dashboard/claims', '/dashboard/claims/approvals', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings', '/dashboard/users'],
    readableEntities: ['profiles:all', 'products:all', 'price_lists:all', 'requests:all', 'invoices:reporting', 'faktur_tasks:all', 'inventory_logs:all', 'delivery_logs:all', 'issues:admin', 'notifications:own', 'activity_logs:all', 'monthly_closing:owner', 'chat:staff', 'leave_requests:all'],
    writableEntities: ['notifications:own', 'leave_requests:all'],
  },
  tax: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/tax-reports', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'invoices:reporting', 'monthly_closing:owner', 'notifications:own', 'chat:staff'],
    writableEntities: ['notifications:own'],
  },
  faktur: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/faktur-tasks', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'faktur_tasks:own', 'faktur_tasks:all', 'notifications:own', 'chat:staff'],
    writableEntities: ['faktur_tasks:own', 'notifications:own'],
  },
  manager: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/approvals', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings', '/dashboard/users'],
    readableEntities: ['profiles:all', 'requests:all', 'inventory_logs:all', 'delivery_logs:all', 'issues:admin', 'chat:staff', 'leave_requests:all'],
    writableEntities: ['notifications:own', 'leave_requests:all'],
  },
  purchasing: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/purchasing', '/dashboard/approvals', '/dashboard/claims', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'products:all', 'inventory_logs:all', 'chat:staff'],
    writableEntities: ['notifications:own'],
  },
  claim_officer: {
    routes: ['/dashboard', '/dashboard/company', '/dashboard/claims', '/dashboard/claims/disbursements', '/dashboard/approvals', '/dashboard/leave', '/dashboard/attendance', '/dashboard/notifications', '/dashboard/profile', '/dashboard/settings'],
    readableEntities: ['profiles:self', 'chat:staff'],
    writableEntities: ['notifications:own'],
  },
};

import { getFeatureByRoute, DEFAULT_FEATURES_BY_ROLE } from './features';
import type { Profile } from '@/types/types';

export function getRolePermissions(role?: UserRole | null): RolePermission | null {
  if (!role) return null;
  return PERMISSIONS[role] ?? null;
}

/**
 * Validates if a Profile has access to a specific route.
 * Instead of checking hardcoded route lists by role, it maps the route to its Feature
 *, and validates if the Profile's features array includes it.
 */
export function canAccessRoute(profile: Profile | undefined | null, route: string): boolean {
  if (!profile) return false;

  const feature = getFeatureByRoute(route);
  
  // If the route doesn't map to a feature flag, check fallback (for things like /dashboard which is default)
  // or default to false to be strictly secure.
  if (!feature) {
    // Basic shared routes that don't need a feature flag
    if (route === '/dashboard' || route === '/dashboard/settings' || route === '/dashboard/notifications') return true;
    return false;
  }

  let userFeatures = profile.features || [];
  if (userFeatures.length === 0) {
    userFeatures = DEFAULT_FEATURES_BY_ROLE[profile.role] || [];
  }

  return userFeatures.includes(feature.id);
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
