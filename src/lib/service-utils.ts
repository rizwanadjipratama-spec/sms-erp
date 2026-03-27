import { supabase } from './supabase';

type ServiceContext = Record<string, unknown> | undefined;

type SystemLogLevel = 'info' | 'warning' | 'error';

const inFlightOperations = new Map<string, Promise<unknown>>();
const lastAutomationRun = new Map<string, number>();

export class ServiceError extends Error {
  service: string;
  operation: string;
  context?: ServiceContext;
  cause?: unknown;

  constructor(params: {
    service: string;
    operation: string;
    message: string;
    cause?: unknown;
    context?: ServiceContext;
  }) {
    super(params.message);
    this.name = 'ServiceError';
    this.service = params.service;
    this.operation = params.operation;
    this.context = params.context;
    this.cause = params.cause;
  }
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack || null,
    };
  }
  if (Array.isArray(value)) {
    return { items: value };
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return { value };
}

export async function logSystemEvent(params: {
  level: SystemLogLevel;
  service: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from('system_logs').insert({
      level: params.level,
      service: params.service,
      action: params.action,
      message: params.message,
      metadata: params.metadata || null,
    });

    if (error) {
      console.error('[system-log-failed]', {
        service: params.service,
        action: params.action,
        message: error.message,
      });
    }
  } catch (error) {
    console.error('[system-log-exception]', {
      service: params.service,
      action: params.action,
      error,
    });
  }
}

export async function logServiceExecution(params: {
  service: string;
  action: string;
  stage: 'start' | 'success' | 'failure';
  startedAt?: number;
  message?: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const executionMs =
    typeof params.startedAt === 'number' ? Math.max(0, Date.now() - params.startedAt) : undefined;

  await logSystemEvent({
    level: params.stage === 'failure' ? 'error' : 'info',
    service: params.service,
    action: `${params.action}.${params.stage}`,
    message:
      params.message ||
      `${params.service} ${params.action} ${params.stage}${executionMs !== undefined ? ` in ${executionMs}ms` : ''}`,
    metadata: {
      ...(params.metadata || {}),
      ...(executionMs !== undefined ? { execution_ms: executionMs } : {}),
    },
  });
}

export function handleServiceError(
  service: string,
  operation: string,
  error: unknown,
  context?: ServiceContext
): ServiceError {
  const message = error instanceof Error ? error.message : 'Unknown service error';
  const wrapped = new ServiceError({
    service,
    operation,
    message,
    cause: error,
    context,
  });

  console.error(`[${service}:${operation}]`, {
    message,
    context,
    error,
  });

  void logSystemEvent({
    level: 'error',
    service,
    action: `${operation}.error`,
    message,
    metadata: {
      context: normalizeMetadata(context),
      error: normalizeMetadata(error),
    },
  });

  return wrapped;
}

export async function withOperationLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = inFlightOperations.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = operation().finally(() => {
    inFlightOperations.delete(key);
  });

  inFlightOperations.set(key, promise as Promise<unknown>);
  return promise;
}

export function isRateLimited(key: string, intervalMs: number) {
  const now = Date.now();
  const lastRun = lastAutomationRun.get(key) || 0;
  if (now - lastRun < intervalMs) {
    return true;
  }
  lastAutomationRun.set(key, now);
  return false;
}
