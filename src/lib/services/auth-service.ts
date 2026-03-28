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
  'marketing@sms.com': 'marketing',
  'finance@sms.com': 'finance',
  'warehouse@sms.com': 'warehouse',
  'technician@sms.com': 'technician',
  'tax@sms.com': 'tax',
};

const ROLE_REDIRECTS: Record<UserRole, string> = {
  client: '/dashboard/client',
  marketing: '/dashboard/marketing',
  boss: '/dashboard/boss',
  finance: '/dashboard/finance',
  warehouse: '/dashboard/warehouse',
  technician: '/dashboard/technician',
  admin: '/dashboard/admin',
  owner: '/dashboard/owner',
  tax: '/dashboard/tax',
};

function getRoleFromEmail(email: string): UserRole {
  return ROLE_EMAILS[email.toLowerCase()] ?? 'client';
}

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      await profilesDb.update(data.user.id, { last_login: new Date().toISOString() }).catch(() => {});
      await activityLogsDb.create({
        user_id: data.user.id,
        user_email: email,
        action: 'sign_in',
        entity_type: 'auth',
      });
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

  getRoleFromEmail,

  ROLE_EMAILS,
  ROLE_REDIRECTS,
};
