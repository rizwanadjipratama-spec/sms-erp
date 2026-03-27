import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

export async function requireAuthUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("User not authenticated");
  return data.user;
}