export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000' as const;
export const SYSTEM_USER_EMAIL = 'system@sms.local' as const;

export const STORAGE_BUCKETS = ['delivery-proofs', 'documents'] as const;

export const MIME_TYPES = {
  JSON: 'application/json',
  PDF: 'application/pdf',
  CSV: 'text/csv;charset=utf-8',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  TEXT: 'text/plain',
} as const;

export const BACKUP_ROOTS = {
  DATABASE: 'backups/database',
  STORAGE: 'backups/storage',
  FULL: 'backups/full',
} as const;

export const MAX_EVENT_RETRIES = 3;
export const EVENT_BATCH_LIMIT = 25;
export const DEFAULT_PAGE_SIZE = 50;
