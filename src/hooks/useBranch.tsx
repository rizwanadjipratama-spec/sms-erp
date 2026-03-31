'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
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

  // Define executives who can switch branches
  const isExecutive = ['admin', 'owner', 'boss', 'director'].includes(profile?.role || '');

  useEffect(() => {
    async function fetchBranches() {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setBranches(data as Branch[]);
      } catch (error) {
        console.error('Error fetching branches:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!authLoading) {
      fetchBranches();
    }
  }, [authLoading]);

  // Enforce branch locking when auth state changes
  useEffect(() => {
    if (authLoading) return;

    if (!isExecutive && profile?.branch_id) {
      // Lock staff and clients to their assigned branch
      setActiveBranchIdState(profile.branch_id);
    } else if (isExecutive && activeBranchId !== 'ALL' && !branches.some(b => b.id === activeBranchId)) {
        // If executive has an invalid branch selected, reset to ALL
        setActiveBranchIdState('ALL');
    }
  }, [profile, isExecutive, authLoading, branches, activeBranchId]);

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
