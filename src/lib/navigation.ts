import { FEATURE_DEFINITIONS, AppFeature, DEFAULT_FEATURES_BY_ROLE } from './features';
import type { Profile } from '@/types/types';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  id: AppFeature;
}

// Map the feature definitions to navigation items
export const NAV_ITEMS: NavItem[] = FEATURE_DEFINITIONS.map(f => ({
  href: f.route,
  label: f.label,
  icon: f.icon,
  id: f.id
}));

/**
 * Returns the exact navigation sidebar items a specific user should see,
 * **in the order defined by their `profile.features` array**.
 * Reordering the array in the DB directly controls sidebar order.
 */
export function getNavigationForProfile(profile: Profile | null): NavItem[] {
  if (!profile) return [];

  let userFeatures = profile.features || [];

  // Fallback to role-based default if they have 0 features assigned
  if (userFeatures.length === 0) {
    userFeatures = DEFAULT_FEATURES_BY_ROLE[profile.role] || [];
  }

  // Ensure persistent utility navigation
  if (!userFeatures.includes('MY_PROFILE')) userFeatures.push('MY_PROFILE');
  if (!userFeatures.includes('SETTINGS')) userFeatures.push('SETTINGS');

  // Build a lookup for O(1) access
  const navLookup = new Map(NAV_ITEMS.map(item => [item.id, item]));

  // Return items in the exact order they appear in userFeatures
  return userFeatures
    .map(featureId => navLookup.get(featureId as AppFeature))
    .filter((item): item is NavItem => item !== undefined);
}
