'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/db/client';
import { useAuth } from '@/hooks/useAuth';
import type { Branch } from '@/types/types';

export function BranchSwitcher() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Global roles that can switch branches
  const isGlobalRole = ['admin', 'owner', 'director', 'manager'].includes(profile?.role || '');

  useEffect(() => {
    if (!isGlobalRole) return;

    // Load branches
    const loadBranches = async () => {
      const { data } = await supabase.from('branches').select('*').order('name');
      if (data) {
        setBranches(data);
        const stored = localStorage.getItem('orion_active_branch');
        if (stored && data.find(b => b.id === stored)) {
          setSelectedBranch(stored);
        } else if (data.length > 0) {
          setSelectedBranch('all');
        }
      }
    };

    loadBranches();
  }, [isGlobalRole]);

  if (!isGlobalRole) return null;

  const handleSwitch = (branchId: string) => {
    setSelectedBranch(branchId);
    if (branchId === 'all') {
      localStorage.removeItem('orion_active_branch');
    } else {
      localStorage.setItem('orion_active_branch', branchId);
    }
    // Refresh page to apply new branch filter everywhere
    window.location.reload();
  };

  return (
    <div className="flex items-center ml-4">
      <select
        value={selectedBranch}
        onChange={(e) => handleSwitch(e.target.value)}
        className="block w-40 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[var(--apple-blue)] sm:text-sm sm:leading-6"
      >
        <option value="all">All Branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
