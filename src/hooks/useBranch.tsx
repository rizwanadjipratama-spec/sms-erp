'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/db/client';
import type { Branch } from '@/types/types';

interface BranchContextType {
  activeBranchId: string; // 'ALL' or a specific branch UUID
  setActiveBranchId: (id: string) => void;
  branches: Branch[];
  isLoading: boolean;
  isExecutive: boolean;
  activeBranchName: string;
}

const BranchContext = createContext<BranchContextType>({
  activeBranchId: 'ALL',
  setActiveBranchId: () => {},
  branches: [],
  isLoading: true,
  isExecutive: false,
  activeBranchName: 'All Branches',
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: authLoading } = useAuth();
  const [activeBranchId, setActiveBranchIdState] = useState<string>('ALL');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLocated, setHasLocated] = useState(false);

  // Define executives who can switch branches
  const isExecutive = ['admin', 'owner', 'boss', 'director'].includes(profile?.role || '');

  // Reset location status when user switches accounts
  useEffect(() => {
    setHasLocated(false);
  }, [profile?.id]);

  useEffect(() => {
    let isMounted = true;
    async function fetchBranches(retries = 3) {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!isMounted) return;
        if (error) throw error;
        setBranches(data as Branch[]);
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err?.message || String(err);
        
        // Next.js StrictMode can cause Web Lock collisions in Supabase auth headers. 
        // We catch it and automatically retry to guarantee the data loads perfectly.
        if ((msg.includes('AbortError') || msg.includes('Lock broken')) && retries > 0) {
          setTimeout(() => fetchBranches(retries - 1), 300);
          return;
        }

        if (!msg.includes('AbortError') && !msg.includes('Lock broken')) {
          console.error('Error fetching branches:', msg);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (!authLoading) {
      fetchBranches();
    }
    return () => { isMounted = false; };
  }, [authLoading]);

  // Enforce branch locking and auto-geolocation when auth and branches are loaded
  useEffect(() => {
    if (authLoading || !profile || branches.length === 0 || hasLocated) return;

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const determineNearestBranch = () => {
      // Respect pinned branch overriding geo-location
      if (profile?.is_branch_pinned && profile?.branch_id) {
        if (!isExecutive) {
          setActiveBranchIdState(profile.branch_id);
        } else if (activeBranchId === null) {
          setActiveBranchIdState('ALL');
        }
        setHasLocated(true);
        return;
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
             const userLat = position.coords.latitude;
             const userLon = position.coords.longitude;
             let nearestBranch = branches[0];
             let minDistance = Infinity;

             branches.forEach(branch => {
               if (branch.latitude && branch.longitude) {
                 const dist = calculateDistance(userLat, userLon, branch.latitude, branch.longitude);
                 if (dist < minDistance) {
                   minDistance = dist;
                   nearestBranch = branch;
                 }
               }
             });

             if (nearestBranch) {
               setActiveBranchIdState(nearestBranch.id);
               if (profile && !profile.branch_id) {
                 supabase.from('profiles').update({ branch_id: nearestBranch.id }).eq('id', profile.id)
                   .then(({ error }) => {
                     if (error) console.error('Failed to auto-sync branch:', error);
                   });
               }
             } else {
               if (!isExecutive && profile?.branch_id) setActiveBranchIdState(profile.branch_id);
             }
             setHasLocated(true);
          },
          (error) => {
             console.warn('Geolocation error:', error);
             if (!isExecutive && profile?.branch_id) {
               setActiveBranchIdState(profile.branch_id);
             } else if (isExecutive) {
               setActiveBranchIdState('ALL');
             }
             setHasLocated(true);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        // Fallback for no geolocation api
        if (!isExecutive && profile?.branch_id) {
          setActiveBranchIdState(profile.branch_id);
        } else if (isExecutive) {
          setActiveBranchIdState('ALL');
        }
        setHasLocated(true);
      }
    };

    determineNearestBranch();
  }, [authLoading, branches, hasLocated, isExecutive, profile]);

  // Handle invalid branch resets for executives who manually change things
  useEffect(() => {
    if (isExecutive && activeBranchId !== 'ALL' && branches.length > 0 && !branches.some(b => b.id === activeBranchId)) {
        setActiveBranchIdState('ALL');
    }
  }, [isExecutive, branches, activeBranchId]);

  // Safe setter that prevents non-executives from switching
  const setActiveBranchId = (id: string) => {
    if (isExecutive) {
      setActiveBranchIdState(id);
    }
  };

  const activeBranchName = activeBranchId === 'ALL' 
    ? 'All Branches' 
    : branches.find(b => b.id === activeBranchId)?.name || 'Unknown Branch';

  return (
    <BranchContext.Provider value={{
      activeBranchId,
      setActiveBranchId,
      branches,
      isLoading: isLoading || authLoading,
      isExecutive,
      activeBranchName,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => useContext(BranchContext);
