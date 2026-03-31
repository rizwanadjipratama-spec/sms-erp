import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const globalForSupabase = global as unknown as { supabase: SupabaseClient<any, "public", any> };

export const supabase =
  globalForSupabase.supabase ||
  createClient<any, "public", any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  );

if (process.env.NODE_ENV !== 'production') globalForSupabase.supabase = supabase;

export async function requireAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('User not authenticated');
  }
  return data.user;
}

export async function getAuthUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
