'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getRoleRedirect } from '@/lib/auth';

export default function DashboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profile) return;
    router.replace(getRoleRedirect(profile.role));
  }, [loading, profile, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
