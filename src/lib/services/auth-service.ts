// ============================================================================
// AUTH SERVICE — Authentication and profile management
// ============================================================================

import { supabase, requireAuthUser, getAuthUser } from '@/lib/db';
import { profilesDb, activityLogsDb } from '@/lib/db';
import type { Profile, UserRole } from '@/types/types';

const ROLE_EMAILS: Record<string, UserRole> = {
  'owner@sms.com': 'owner',
  'admin@sms.com': 'admin',
  'boss@sms.com': 'boss',
  'director@sms.com': 'director',
  'marketing@sms.com': 'marketing',
  'finance@sms.com': 'finance',
  'warehouse@sms.com': 'warehouse',
  'technician@sms.com': 'technician',
  'courier@sms.com': 'courier',
  'tax@sms.com': 'tax',
};

const ROLE_REDIRECTS: Record<UserRole, string> = {
  client: '/dashboard/client',
  marketing: '/dashboard/marketing',
  boss: '/dashboard/boss',
  director: '/dashboard/director',
  finance: '/dashboard/finance',
  warehouse: '/dashboard/warehouse',
  technician: '/dashboard/technician',
  courier: '/dashboard/courier',
  admin: '/dashboard/admin',
  owner: '/dashboard/owner',
  tax: '/dashboard/tax',
  faktur: '/dashboard/faktur',
  manager: '/dashboard/approvals',
  purchasing: '/dashboard/purchasing',
  claim_officer: '/dashboard/claims',
};

function getRoleFromEmail(email: string): UserRole {
  return ROLE_EMAILS[email.toLowerCase()] ?? 'client';
}

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    // Fire-and-forget: non-critical side effects should never block login
    if (data.user) {
      profilesDb.update(data.user.id, { last_login: new Date().toISOString() }).catch(() => {});
      activityLogsDb.create({
        user_id: data.user.id,
        user_email: email,
        action: 'sign_in',
        entity_type: 'auth',
      }).catch(() => {});
    }

    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    const user = await getAuthUser();
    if (user) {
      await activityLogsDb.create({
        user_id: user.id,
        user_email: user.email,
        action: 'sign_out',
        entity_type: 'auth',
      });
    }
    await supabase.auth.signOut();
  },

  async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  },

  async getProfile(): Promise<Profile | null> {
    const user = await getAuthUser();
    if (!user?.email) return null;

    let profile = await profilesDb.getById(user.id);

    if (!profile) {
      const role = getRoleFromEmail(user.email);
      profile = await profilesDb.upsert({
        id: user.id,
        email: user.email,
        role,
        name: user.email.split('@')[0],
        debt_amount: 0,
        debt_limit: 500000,
        is_active: true,
        two_factor_enabled: false,
      });
    } else {
      // Sync role for staff emails
      const expectedRole = getRoleFromEmail(user.email);
      if (ROLE_EMAILS[user.email.toLowerCase()] && profile.role !== expectedRole) {
        profile = await profilesDb.update(user.id, { role: expectedRole });
      }
    }

    return profile;
  },

  async getCurrentUser() {
    const user = await getAuthUser();
    if (!user?.email) return null;
    const profile = await this.getProfile();
    if (!profile) return null;
    return { ...user, profile };
  },

  getRoleRedirect(role: UserRole): string {
    return ROLE_REDIRECTS[role] ?? '/dashboard/client';
  },

  /**
   * Check if a profile has all mandatory fields filled.
   * Client profiles require full company info. Staff profiles need name + branch.
   */
  isProfileComplete(profile: Profile): boolean {
    const baseComplete = Boolean(
      profile.name?.trim()
      && profile.phone?.trim()
      && profile.branch_id
    );

    if (profile.role === 'client') {
      return baseComplete && Boolean(
        profile.company?.trim()
        && profile.address?.trim()
        && profile.city?.trim()
        && profile.province?.trim()
        && profile.client_type
        && profile.pic_name?.trim()
      );
    }

    // Staff profiles: name + phone + branch is enough
    return baseComplete;
  },

  getRoleFromEmail,

  ROLE_EMAILS,
  ROLE_REDIRECTS,
};
