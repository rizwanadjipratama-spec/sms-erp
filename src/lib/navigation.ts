import type { AppRoute } from './permissions';

export interface NavItem {
  href: AppRoute;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'H' },
  { href: '/dashboard/client', label: 'My Orders', icon: 'O' },
  { href: '/request', label: 'New Request', icon: 'N' },
  { href: '/dashboard/marketing', label: 'Marketing', icon: 'M' },
  { href: '/dashboard/marketing/prices', label: 'Price List', icon: 'P' },
  { href: '/dashboard/boss', label: 'Approvals', icon: 'B' },
  { href: '/dashboard/finance', label: 'Finance', icon: 'F' },
  { href: '/dashboard/warehouse', label: 'Warehouse', icon: 'W' },
  { href: '/dashboard/technician', label: 'Delivery', icon: 'D' },
  { href: '/dashboard/client/products', label: 'Browse Products', icon: 'C' },
  { href: '/dashboard/client/issues', label: 'Issues', icon: 'I' },
  { href: '/dashboard/tax', label: 'Tax Reports', icon: 'T' },
  { href: '/dashboard/owner', label: 'Analytics', icon: 'A' },
  { href: '/dashboard/owner/reports', label: 'Reports', icon: 'R' },
  { href: '/dashboard/admin', label: 'Admin Panel', icon: 'S' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: 'N' },
];
