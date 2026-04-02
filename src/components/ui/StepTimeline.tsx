import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import type { RequestStatusLog, RequestStatus, StaffRating } from '@/types/types';
import { formatDateTime } from '@/lib/format-utils';
import { staffRatingsDb } from '@/lib/db';

interface StepTimelineProps {
  currentStatus: RequestStatus;
  requestId: string;
  logs: RequestStatusLog[];   // The history of handlers for this request
  ratings: StaffRating[];     // Existing ratings by the client for this request
  clientId: string;
  onRatingSubmitted: (rating: StaffRating) => void;
}

const TIMELINE_STEPS: Array<{ key: RequestStatus; label: string }> = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'priced', label: 'Priced' },
  { key: 'approved', label: 'Approved' },
  { key: 'invoice_ready', label: 'Invoice' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'on_delivery', label: 'On Delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
];

function getStepIndex(status: RequestStatus) {
  return TIMELINE_STEPS.findIndex((step) => step.key === status);
}

// Calculate duration in human readable format between two date strings
function getDurationElapsed(startStr: string, endStr: string): string {
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const diffMs = end - start;
  
  if (diffMs <= 0) return '0m';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffMins}m`;
}

function getTenure(joinedDateStr?: string | null): string | null {
  if (!joinedDateStr) return null;
  const start = new Date(joinedDateStr);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years > 0) {
    return `Joined ${years} year${years > 1 ? 's' : ''} ago`;
  } else if (months > 0) {
    return `Joined ${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    return 'Joined recently';
  }
}

export function StepTimeline({ currentStatus, requestId, logs, ratings, clientId, onRatingSubmitted }: StepTimelineProps) {
  const currentStepIndex = getStepIndex(currentStatus);
  const [submittingRating, setSubmittingRating] = useState<string | null>(null);
  const [quoteIndices, setQuoteIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    // Collect all valid quoted logs
    const validLogs = logs.filter(l => l.actor?.quotes && l.actor.quotes.length > 0);
    if (validLogs.length === 0) return;

    // Cycle quotes every 5 seconds
    const interval = setInterval(() => {
      setQuoteIndices(prev => {
        const nextIndices = { ...prev };
        validLogs.forEach(log => {
          const currentIdx = nextIndices[log.actor!.id] || 0;
          nextIndices[log.actor!.id] = (currentIdx + 1) % log.actor!.quotes!.length;
        });
        return nextIndices;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [logs]);

  const handleRate = async (status: RequestStatus, staffId: string, ratingValue: number) => {
    if (submittingRating) return;
    setSubmittingRating(status);
    try {
      const newRating = await staffRatingsDb.upsert({
        request_id: requestId,
        status,
        staff_id: staffId,
        client_id: clientId,
        rating: ratingValue
      });
      onRatingSubmitted(newRating);
    } catch (err) {
      console.error('Failed to submit rating:', err);
      alert('Failed to save rating. Please try again.');
    } finally {
      setSubmittingRating(null);
    }
  };

  return (
    <div className="py-2 overflow-x-auto custom-scrollbar">
      <div className="flex min-w-max gap-4 px-2">
        {TIMELINE_STEPS.map((step, index) => {
          const isDone = currentStepIndex >= index;
          const isCurrent = currentStatus === step.key;
          const log = logs.find(l => l.status === step.key);
          const previousLog = index > 0 ? logs.find(l => l.status === TIMELINE_STEPS[index - 1].key) : undefined;
          
          // Submitted step isn't handled by staff, so we don't need a handler card/rating
          const isHandlerStep = step.key !== 'submitted' && step.key !== 'completed' && step.key !== 'delivered';
          const ratingObj = ratings.find(r => r.status === step.key);

          return (
            <div key={step.key} className="flex flex-col flex-1 min-w-[200px] relative">
              {/* Connector line */}
              {index < TIMELINE_STEPS.length - 1 && (
                <div 
                  className={`absolute top-4 left-1/2 w-full h-0.5 -z-10 ${
                    currentStepIndex > index ? 'bg-apple-blue' : 'bg-gray-200'
                  }`} 
                />
              )}

              {/* Step indicator */}
              <div className="flex flex-col items-center text-center gap-2 mb-4">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                    isDone
                      ? 'bg-apple-blue border-apple-blue text-white shadow-sm'
                      : 'bg-white border-apple-gray-border text-apple-text-secondary'
                  }`}
                >
                  {index + 1}
                </div>
                <p
                  className={`text-[10px] font-bold uppercase tracking-tight ${
                    isCurrent ? 'text-apple-blue' : (isDone ? 'text-gray-800' : 'text-apple-text-secondary')
                  }`}
                >
                  {step.label}
                </p>
                {log && (
                  <p className="text-[9px] text-gray-500 font-medium">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {/* Elapsed time pill if we have previous step time */}
                {log && previousLog && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                    ⏱ {getDurationElapsed(previousLog.created_at, log.created_at)}
                  </span>
                )}
              </div>

              {/* Handler Card */}
              {isHandlerStep && isDone && log && log.actor && (
                <div className="mt-2 bg-white border border-gray-200 rounded-xl p-3 shadow-sm relative group">
                  <div className="flex items-start gap-3">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[var(--apple-blue)]/10 shrink-0">
                      {log.actor.avatar_url ? (
                        <Image src={log.actor.avatar_url} alt={log.actor.name || 'Staff'} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--apple-blue)] font-bold text-sm">
                          {(log.actor.name || log.actor.email)[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] font-bold text-[var(--apple-text-primary)] truncate leading-tight" title={log.actor.name || ''}>
                          {log.actor.name || 'Staff Member'}
                        </p>
                        {/* Current Rating */}
                        <div className="flex items-center gap-0.5" title={`Overall Rating: ${(log.actor.avg_rating || 0).toFixed(1)}`}>
                          <div className="flex items-center text-[8px]">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={(log.actor!.avg_rating || 0) >= star ? "text-amber-400" : "text-gray-200"}>★</span>
                            ))}
                          </div>
                          <span className="text-[9px] font-bold text-[var(--apple-text-secondary)] ml-0.5">
                            {(log.actor.avg_rating || 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[9px] text-[var(--apple-text-tertiary)] uppercase tracking-wider font-bold mt-0.5 truncate">
                        {log.actor.role}
                      </p>
                      {/* Tenure */}
                      {getTenure(log.actor.joined_date) && (
                        <p className="text-[8px] text-[var(--apple-blue)] font-semibold mt-0.5">
                          {getTenure(log.actor.joined_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  {log.actor.quotes && log.actor.quotes.length > 0 && (
                    <div className="mt-3 bg-[var(--apple-gray-bg)] rounded-lg p-2 relative">
                      <p className="text-[10px] italic text-[var(--apple-text-secondary)] leading-snug line-clamp-2 transition-all">
                        "{log.actor.quotes[quoteIndices[log.actor.id] || 0]}"
                      </p>
                    </div>
                  )}

                  {/* Rating Stars */}
                  <div className="mt-3 pt-3 border-t border-[var(--apple-border)] flex flex-col items-center gap-1.5">
                    {!ratingObj && (
                      <p className="text-[9px] font-bold text-[var(--apple-text-secondary)] uppercase tracking-wider">Rate your handler</p>
                    )}
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          disabled={!!submittingRating}
                          onClick={() => handleRate(step.key, log.actor!.id, star)}
                          className={`text-lg focus:outline-none transition-transform hover:scale-110 disabled:opacity-50 ${
                            (ratingObj?.rating || 0) >= star ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'
                          }`}
                          title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
