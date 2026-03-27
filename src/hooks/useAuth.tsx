'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserRole, Profile } from '@/types/types';
import { getProfile, signInWithPassword } from '@/lib/auth';

type AuthContextType = {
  profile: Profile | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const role = profile?.role || 'user';

  useEffect(() => {
    // Initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        getProfile().then(setProfile);
      }
      setLoading(false);
    });

    // Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        const prof = await getProfile();
        setProfile(prof);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password?: string) => {
    if (password) {
      try {
        await signInWithPassword(email, password);
      } catch (error) {
        console.error('Sign in error:', error);
        throw error;
      }
    }
  };

  const logoutFn = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, role, loading, signIn, logout: logoutFn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

