'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Error Caught:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-full w-16 h-16 flex items-center justify-center mb-6">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        An error occurred while loading this dashboard page. The error has been logged automatically.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-colors font-medium text-sm"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
