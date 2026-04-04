export type AppFeature = 
  | 'COMPANY'
  | 'MARKETING'
  | 'MARKETING_CLIENTS'
  | 'PRICE_LIST'
  | 'APPROVALS'
  | 'FINANCE'
  | 'WAREHOUSE'
  | 'INVENTORY'
  | 'CATALOG'
  | 'CREATE_PR'
  | 'PR_APPROVALS'
  | 'DELIVERY'
  | 'MY_INVENTORY'
  | 'COURIER'
  | 'TAX_REPORTS'
  | 'ANALYTICS'
  | 'REPORTS'
  | 'DIRECTOR_OVERVIEW'
  | 'ADMIN_PANEL'
  | 'CLAIMS'
  | 'CLAIM_APPROVALS'
  | 'DISBURSEMENTS'
  | 'TIME_OFF'
  | 'MY_PROFILE'
  | 'ATTENDANCE'
  | 'CMS'
  | 'USERS'
  | 'CLIENT_ORDERS'
  | 'CLIENT_PRODUCTS'
  | 'CLIENT_ISSUES'
  | 'CLIENT_NEW_REQUEST';

export interface FeatureDefinition {
  id: AppFeature;
  label: string;
  icon: string;
  route: string;
  description?: string;
  clientOnly?: boolean;  // Mark true if only clients use it
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  { id: 'COMPANY', label: 'Company Overview', icon: '🏢', route: '/dashboard/company' },
  { id: 'MARKETING', label: 'Marketing', icon: '📣', route: '/dashboard/marketing' },
  { id: 'MARKETING_CLIENTS', label: 'My Clients', icon: '👥', route: '/dashboard/marketing/clients' },
  { id: 'PRICE_LIST', label: 'Price List', icon: '💰', route: '/dashboard/marketing/prices' },
  { id: 'APPROVALS', label: 'Approvals', icon: '✅', route: '/dashboard/boss' },
  { id: 'FINANCE', label: 'Finance', icon: '💵', route: '/dashboard/finance' },
  { id: 'WAREHOUSE', label: 'Warehouse', icon: '🏭', route: '/dashboard/warehouse' },
  { id: 'INVENTORY', label: 'Inventory', icon: '📦', route: '/dashboard/warehouse/inventory' },
  { id: 'CATALOG', label: 'Catalog', icon: '📖', route: '/dashboard/warehouse/catalog' },
  { id: 'CREATE_PR', label: 'Create Purchase Request', icon: '🛒', route: '/dashboard/warehouse/request-purchase' },
  { id: 'PR_APPROVALS', label: 'PR Approvals', icon: '📝', route: '/dashboard/procurement-approvals' },
  { id: 'DELIVERY', label: 'Delivery & Logistic', icon: '🚚', route: '/dashboard/technician' },
  { id: 'MY_INVENTORY', label: 'My Tech Inventory', icon: '🔧', route: '/dashboard/technician/inventory' },
  { id: 'COURIER', label: 'Courier Portal', icon: '🛵', route: '/dashboard/courier' },
  { id: 'TAX_REPORTS', label: 'Tax Reports', icon: '📊', route: '/dashboard/tax' },
  { id: 'ANALYTICS', label: 'Analytics', icon: '📈', route: '/dashboard/owner' },
  { id: 'REPORTS', label: 'Reports', icon: '📋', route: '/dashboard/owner/reports' },
  { id: 'DIRECTOR_OVERVIEW', label: 'Director Overview', icon: '👁️', route: '/dashboard/director' },
  { id: 'ADMIN_PANEL', label: 'Admin Panel', icon: '⚙️', route: '/dashboard/admin' },
  { id: 'CLAIMS', label: 'Claims & Requests', icon: '🧾', route: '/dashboard/claims' },
  { id: 'CLAIM_APPROVALS', label: 'Claim Approvals', icon: '👍', route: '/dashboard/claims/approvals' },
  { id: 'DISBURSEMENTS', label: 'Disbursements', icon: '💸', route: '/dashboard/claims/disbursements' },
  { id: 'TIME_OFF', label: 'Time Off', icon: '🏖️', route: '/dashboard/leave' },
  { id: 'ATTENDANCE', label: 'Attendance', icon: '⏱️', route: '/dashboard/attendance' },
  { id: 'CMS', label: 'CMS System', icon: '🌐', route: '/dashboard/cms' },
  { id: 'USERS', label: 'Users Management', icon: '🧑‍💼', route: '/dashboard/users' },
  { id: 'MY_PROFILE', label: 'My Profile', icon: '👤', route: '/dashboard/profile' },
  
  // Client Features
  { id: 'CLIENT_ORDERS', label: 'My Orders', icon: '🛍️', route: '/dashboard/client', clientOnly: true },
  { id: 'CLIENT_NEW_REQUEST', label: 'New Request', icon: '➕', route: '/request', clientOnly: true },
  { id: 'CLIENT_PRODUCTS', label: 'Browse Products', icon: '🔍', route: '/dashboard/client/products', clientOnly: true },
  { id: 'CLIENT_ISSUES', label: 'Issues', icon: '⚠️', route: '/dashboard/client/issues', clientOnly: true },
];

export function getFeatureByRoute(route: string): FeatureDefinition | undefined {
  return FEATURE_DEFINITIONS.find(f => {
    // exact match
    if (f.route === route) return true;
    
    // Sub-route match (e.g. /dashboard/users/123 -> matches /dashboard/users)
    // but be careful not to match /dashboard/claims against /dashboard/claims/approvals
    return route.startsWith(f.route + '/');
  });
}
