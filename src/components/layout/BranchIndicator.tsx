'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBranch } from '@/hooks/useBranch';

export default function BranchIndicator() {
  const { activeBranchId, setActiveBranchId, branches, isExecutive, activeBranchName, isLoading } = useBranch();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-full bg-gray-100" />
    );
  }

  // If not executive, they are locked to their branch - show a permanent badge
  if (!isExecutive) {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 border border-emerald-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        <span className="text-[11px] font-bold tracking-wide text-emerald-700 uppercase">
          {activeBranchName}
        </span>
      </div>
    );
  }

  // If Executive, show the interactive context switcher
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all outline-none ${
          isOpen
            ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-2 ring-blue-500/20 ring-offset-1'
            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm'
        }`}
      >
        <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <span className="text-[11px] font-bold tracking-wider uppercase">
          {activeBranchName}
        </span>
        <svg 
          className={`w-3.5 h-3.5 opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={2} 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 mt-2 z-50 w-56 overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl"
            >
              <div className="px-3 py-2">
                <p className="text-[10px] font-black tracking-wider text-gray-400 uppercase">
                  Global Context
                </p>
              </div>
              
              <button
                onClick={() => {
                  setActiveBranchId('ALL');
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                  activeBranchId === 'ALL'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100/80'
                }`}
              >
                All Branches
                {activeBranchId === 'ALL' && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>

              <div className="my-1 border-t border-gray-100" />
              
              <div className="px-3 py-2">
                <p className="text-[10px] font-black tracking-wider text-gray-400 uppercase">
                  Local Branches
                </p>
              </div>

              {branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => {
                    setActiveBranchId(branch.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                    activeBranchId === branch.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100/80'
                  }`}
                >
                  {branch.name}
                  {activeBranchId === branch.id && (
                    <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
