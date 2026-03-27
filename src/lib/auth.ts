import { supabase } from './supabase';
import type { Profile, UserRole } from '@/types/types.ts';
import { ADMIN_EMAILS } from './admin';
import { ROLE_REDIRECTS } from './workflow';

const OWNER_EMAIL = ADMIN_EMAILS[0];
const OTHER_ADMINS = ADMIN_EMAILS.slice(1);

export const getLegacyRole = (email?: string | null): UserRole => {
  if (!email) return 'user';
  if (email === OWNER_EMAIL) return 'owner';
  if (OTHER_ADMINS.includes(email)) return 'admin';
  return 'client';
};

export const getUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

export const getRole = (email?: string | null): UserRole => getLegacyRole(email);

export const getRoleRedirect = (role?: UserRole | null) =>
  ROLE_REDIRECTS[role || 'client'] || '/dashboard/client';

export const signInWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const forgotPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  await supabase.auth.signOut();
};

export const getProfile = async (): Promise<Profile | null> => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user?.email) return null;

  const { data: profileById } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileById) {
    return profileById as Profile;
  }

  const { data: profileByEmail } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', user.email)
    .maybeSingle();

  if (profileByEmail) {
    return profileByEmail as Profile;
  }

  const newProfile = {
    id: user.id,
    email: user.email,
    role: getLegacyRole(user.email),
    debt_amount: 0,
    debt_limit: 500000,
    two_factor_secret: null,
    two_factor_enabled: false,
  };

  const { error: insertError } = await supabase.from('profiles').insert(newProfile);
  if (insertError) {
    console.error('Profile creation failed:', insertError);
    return newProfile as Profile;
  }

  return newProfile as Profile;
};
