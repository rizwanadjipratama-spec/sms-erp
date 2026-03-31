'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/types';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';

import { ClientProfileForm } from '@/components/profile/ClientProfileForm';
import { StaffProfileForm } from '@/components/profile/StaffProfileForm';

export default function MyProfilePage() {
  const { profile: authProfile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!authLoading && !authProfile) router.push('/login');
    if (!authLoading && authProfile && !canAccessRoute(authProfile.role, '/dashboard/profile')) {
      router.replace(authService.getRoleRedirect(authProfile.role));
    }
  }, [authLoading, authProfile, router]);

  const loadProfile = useCallback(async () => {
    if (!authProfile) return;
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*, branch:branches(*)')
        .eq('id', authProfile.id)
        .single();

      if (error) throw error;
      setFullProfile(data as Profile);
    } catch (err) {
      console.error('Failed to load full profile', err);
    } finally {
      setFetching(false);
    }
  }, [authProfile]);

  useEffect(() => {
    if (authProfile) loadProfile();
  }, [authProfile, loadProfile]);

  const handleProfileUpdate = async (updates: Partial<Profile>) => {
    setFullProfile(prev => prev ? { ...prev, ...updates } : null);
    // Refresh the auth context so the layout guard knows profile is now complete
    await refreshProfile();
  };

  if (authLoading || fetching || !fullProfile) {
    return <div className="p-4 mx-auto max-w-4xl"><DashboardSkeleton /></div>;
  }

  const isClient = fullProfile.role === 'client';
  const isOnboarding = isClient && !fullProfile.profile_completed;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500 p-4">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Profile</h1>
        <p className="text-gray-500 font-medium mt-1">Manage your personal settings and contact information.</p>
      </div>

      {/* Onboarding banner for new clients */}
      {isOnboarding && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-lg">⚠️</div>
          <div>
            <p className="font-bold text-amber-900 text-sm">Complete your profile to get started</p>
            <p className="text-amber-700 text-xs mt-1">
              Please fill in all required fields below before you can browse products or create requests.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 overflow-hidden shadow-sm rounded-2xl">
        
        {/* Header Cover & Avatar */}
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute w-[200%] h-full top-0 left-[-50%] fill-white">
              <path d="M0,50 C20,70 50,20 100,60 L100,100 L0,100 Z" />
            </svg>
          </div>
        </div>
        
        <div className="px-6 md:px-10 pb-8 relative">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-end -mt-12 sm:-mt-16 mb-8">
            <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white bg-white shadow-lg shrink-0 overflow-hidden flex items-center justify-center relative z-10">
              {fullProfile.avatar_url ? (
                <img src={fullProfile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-4xl sm:text-5xl font-black text-gray-400">
                  {fullProfile.name?.charAt(0) || fullProfile.email.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-1 pb-2">
              <h2 className="text-2xl font-black text-gray-900">{fullProfile.name || 'Unnamed User'}</h2>
              <p className="text-gray-500 font-medium flex items-center gap-2">
                <span>{fullProfile.email}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Active"></span>
              </p>
            </div>
          </div>

          <div className="max-w-3xl">
            {isClient ? (
              <ClientProfileForm initialProfile={fullProfile} onUpdate={handleProfileUpdate} />
            ) : (
              <StaffProfileForm initialProfile={fullProfile} onUpdate={handleProfileUpdate} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
