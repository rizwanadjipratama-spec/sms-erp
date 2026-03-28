'use client';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-16 text-center dark:border-red-900/30 dark:bg-red-900/10">
      <span className="mb-3 text-4xl">&#x26A0;&#xFE0F;</span>
      <h3 className="mb-1 text-lg font-semibold text-red-900 dark:text-red-300">
        {title}
      </h3>
      <p className="mb-4 max-w-sm text-sm text-red-600 dark:text-red-400">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
