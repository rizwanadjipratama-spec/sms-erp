'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authService } from '@/lib/services';

export default function DashboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profile) return;
    router.replace(authService.getRoleRedirect(profile.role));
  }, [loading, profile, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-apple-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-apple-text-secondary text-sm font-medium">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
