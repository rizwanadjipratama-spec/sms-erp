import type { AppRoute } from './permissions';

export interface NavItem {
  href: AppRoute;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/company', label: 'Company', icon: 'G' },
  { href: '/dashboard/client', label: 'My Orders', icon: 'O' },
  { href: '/request', label: 'New Request', icon: 'N' },
  { href: '/dashboard/marketing', label: 'Marketing', icon: 'M' },
  { href: '/dashboard/marketing/clients', label: 'My Clients', icon: 'U' },
  { href: '/dashboard/marketing/prices', label: 'Price List', icon: 'P' },
  { href: '/dashboard/boss', label: 'Approvals', icon: 'B' },
  { href: '/dashboard/finance', label: 'Finance', icon: 'F' },
  { href: '/dashboard/warehouse', label: 'Warehouse', icon: 'W' },
  { href: '/dashboard/warehouse/inventory', label: 'Inventory', icon: 'I' },
  { href: '/dashboard/warehouse/catalog', label: 'Catalog', icon: 'C' },
  { href: '/dashboard/warehouse/request-purchase', label: 'Create PR', icon: 'P' },
  { href: '/dashboard/procurement-approvals', label: 'PR Approvals', icon: 'P' },
  { href: '/dashboard/technician', label: 'Delivery', icon: 'D' },
  { href: '/dashboard/courier', label: 'Courier', icon: 'K' },
  { href: '/dashboard/client/products', label: 'Browse Products', icon: 'C' },
  { href: '/dashboard/client/issues', label: 'Issues', icon: 'I' },
  { href: '/dashboard/tax', label: 'Tax Reports', icon: 'T' },
  { href: '/dashboard/owner', label: 'Analytics', icon: 'A' },
  { href: '/dashboard/owner/reports', label: 'Reports', icon: 'R' },
  { href: '/dashboard/director', label: 'Director Overview', icon: 'V' },
  { href: '/dashboard/admin', label: 'Admin Panel', icon: 'S' },
  { href: '/dashboard/leave', label: 'Time Off', icon: 'L' },
  { href: '/dashboard/profile', label: 'My Profile', icon: 'U' },
  { href: '/dashboard/attendance', label: 'Attendance', icon: 'T' },
  { href: '/dashboard/cms', label: 'CMS System', icon: 'W' },
];
