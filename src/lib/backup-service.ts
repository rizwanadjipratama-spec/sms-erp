import { createNotificationsForUsers, fetchProfilesByRoles } from './workflow';
import { logActivity } from './activity';
import { handleServiceError, logServiceExecution, logSystemEvent, withOperationLock } from './service-utils';
import { supabase } from './supabase';
import { SYSTEM_USER_ID, SYSTEM_USER_EMAIL, MIME_TYPES, BACKUP_ROOTS, STORAGE_BUCKETS } from './constants';
import type { BackupLog, UserRole } from '@/types/types';

const DOCUMENT_BUCKET = 'documents';
const STORAGE_BACKUP_ROOT = 'backups/storage';
const DATABASE_BACKUP_ROOT = 'backups/database';
const FULL_BACKUP_ROOT = 'backups/full';
const DATABASE_TABLES = [
  'profiles',
  'products',
  'price_list',
  'requests',
  'invoices',
  'inventory_logs',
  'delivery_logs',
  'issues',
  'notifications',
  'activity_logs',
  'monthly_closing',
  'payment_promises',
  'automation_events',
  'automation_webhooks',
  'automation_logs',
  'email_templates',
  'system_logs',
] as const;

type BackupActor = {
  id: string;
  email?: string;
  role: UserRole;
};

type StorageManifestFile = {
  bucket: string;
  path: string;
  backupPath: string;
  size?: number | null;
  updatedAt?: string | null;
};

type DatabaseBackupSnapshot = {
  backupId: string;
  type: 'database';
  generatedAt: string;
  tables: Record<string, unknown[]>;
  inaccessibleTables: string[];
};

type StorageBackupSnapshot = {
  backupId: string;
  type: 'storage';
  generatedAt: string;
  buckets: Record<string, StorageManifestFile[]>;
};

type FullBackupSnapshot = {
  backupId: string;
  type: 'full';
  generatedAt: string;
  databasePath: string;
  storagePath: string;
};

async function restoreDatabaseSnapshotFromPath(path: string) {
  const downloadRes = await supabase.storage.from(DOCUMENT_BUCKET).download(path);
  if (downloadRes.error) throw new Error(downloadRes.error.message);

  const text = await downloadRes.data.text();
  const parsed = JSON.parse(text) as DatabaseBackupSnapshot;
  if (parsed.type !== 'database') {
    throw new Error('Invalid database backup snapshot');
  }

  for (const table of DATABASE_TABLES) {
    const rows = parsed.tables[table];
    if (Array.isArray(rows) && rows.length > 0) {
      await chunkedUpsert(table, rows as Record<string, unknown>[]);
    }
  }
}

async function restoreStorageSnapshotFromPath(path: string) {
  const downloadRes = await supabase.storage.from(DOCUMENT_BUCKET).download(path);
  if (downloadRes.error) throw new Error(downloadRes.error.message);

  const text = await downloadRes.data.text();
  const parsed = JSON.parse(text) as StorageBackupSnapshot;
  if (parsed.type !== 'storage') {
    throw new Error('Invalid storage backup snapshot');
  }

  for (const files of Object.values(parsed.buckets)) {
    for (const file of files) {
      const source = await supabase.storage.from(DOCUMENT_BUCKET).download(file.backupPath);
      if (source.error) throw new Error(source.error.message);
      const bytes = new Uint8Array(await source.data.arrayBuffer());
      const { error } = await supabase.storage.from(file.bucket).upload(file.path, bytes, {
        upsert: true,
        contentType: source.data.type || 'application/octet-stream',
      });
      if (error) throw new Error(error.message);
    }
  }
}

function assertBackupActor(role: UserRole) {
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Only admin or owner can manage backups');
  }
}

function timestampKey() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9/_-]+/g, '-');
}

async function createBackupLog(backupType: BackupLog['backup_type'], notes?: string) {
  const { data, error } = await supabase
    .from('backup_logs')
    .insert({
      backup_type: backupType,
      status: 'pending',
      notes: notes || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as BackupLog;
}

async function updateBackupLog(id: string, updates: Partial<BackupLog>) {
  const { data, error } = await supabase
    .from('backup_logs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as BackupLog;
}

async function uploadBackupFile(params: {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(params.path, params.bytes, {
    contentType: params.contentType,
    upsert: true,
  });

  if (error) throw new Error(`Backup upload failed: ${error.message}`);
  
  return params.path;
}

async function createSignedDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function listStorageRecursive(bucket: string, prefix = ''): Promise<Array<{ name: string; id?: string; metadata?: { size?: number }; updated_at?: string }>> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) throw new Error(error.message);

  const entries = data || [];
  const files: Array<{ name: string; id?: string; metadata?: { size?: number }; updated_at?: string }> = [];

  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const isFolder = !entry.id;
    if (bucket === 'documents' && fullPath.startsWith('backups/')) {
      continue;
    }
    if (isFolder) {
      const nested = await listStorageRecursive(bucket, fullPath);
      files.push(...nested.map((item) => ({ ...item, name: item.name })));
    } else {
      files.push({
        name: fullPath,
        id: entry.id || undefined,
        metadata: entry.metadata as { size?: number } | undefined,
        updated_at: entry.updated_at || undefined,
      });
    }
  }

  return files;
}

async function copyStorageFileToBackup(params: {
  sourceBucket: string;
  sourcePath: string;
  backupId: string;
}) {
  try {
    const downloadRes = await supabase.storage.from(params.sourceBucket).download(params.sourcePath);
    if (downloadRes.error) {
      console.warn('Skipping unreadable backup file:', params.sourcePath, downloadRes.error.message);
      return null;
    }

    const arrayBuffer = await downloadRes.data.arrayBuffer();
    const backupPath = `${BACKUP_ROOTS.STORAGE}/${params.backupId}/${params.sourceBucket}/${sanitizePathSegment(params.sourcePath)}`;
    await uploadBackupFile({
      path: backupPath,
      bytes: new Uint8Array(arrayBuffer),
      contentType: downloadRes.data.type || 'application/octet-stream',
    });

    return backupPath;
  } catch (error) {
    console.error('Backup copy failed:', params.sourcePath, error);
    return null;
  }
}

async function fetchTableRows(table: string) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

async function notifyOwners(message: string) {
  try {
    const owners = await fetchProfilesByRoles(['owner']);
    const ownerIds = owners.map((profile) => profile.id).filter(Boolean) as string[];
    if (ownerIds.length > 0) {
      await createNotificationsForUsers(ownerIds, message, 'info');
    }
  } catch (error) {
    console.error('Owner backup notification failed:', error);
  }
}

async function activity(actor: BackupActor, action: string, backupId: string, metadata?: Record<string, unknown>) {
  await logActivity(actor.id, action, 'backup', backupId, metadata, actor.email);
}

async function chunkedUpsert(table: string, rows: Record<string, unknown>[]) {
  const chunkSize = 100;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }
}

export const backupService = {
  async getBackupLogs(limit = 50) {
    const { data, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw handleServiceError('backup-service', 'getBackupLogs', error, { limit });
    return (data || []) as BackupLog[];
  },

  async backupDatabase(actor: BackupActor) {
    assertBackupActor(actor.role);

    return withOperationLock('backup:database', async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'backup-service',
        action: 'backupDatabase',
        stage: 'start',
        startedAt,
        metadata: { actorId: actor.id },
      });

      const log = await createBackupLog('database', `Database backup started by ${actor.email || actor.id}`);

      try {
        const tables: Record<string, unknown[]> = {};
        const inaccessibleTables: string[] = [];

        for (const table of DATABASE_TABLES) {
          try {
            tables[table] = await fetchTableRows(table);
          } catch (error) {
            inaccessibleTables.push(table);
            await logSystemEvent({
              level: 'warning',
              service: 'backup-service',
              action: 'backupDatabase.tableSkipped',
              message: `Skipping table ${table} during database backup`,
              metadata: {
                table,
                error: error instanceof Error ? error.message : 'Unknown table backup error',
              },
            });
          }
        }

        const snapshot: DatabaseBackupSnapshot = {
          backupId: log.id,
          type: 'database',
          generatedAt: new Date().toISOString(),
          tables,
          inaccessibleTables,
        };

        const bytes = jsonBytes(snapshot);
        const path = `${BACKUP_ROOTS.DATABASE}/${log.id}-${timestampKey()}.json`;
        await uploadBackupFile({
          path,
          bytes,
          contentType: 'application/octet-stream', // Use octet-stream to avoid MIME type restrictions
        });

        const completedLog = await updateBackupLog(log.id, {
          status: inaccessibleTables.length > 0 ? 'partial' : 'completed',
          file_url: path,
          completed_at: new Date().toISOString(),
          size: bytes.byteLength,
          notes:
            inaccessibleTables.length > 0
              ? `Backup completed with skipped tables: ${inaccessibleTables.join(', ')}`
              : 'Database backup completed successfully',
        });

        await activity(actor, 'backup_database_created', log.id, {
          backup_type: 'database',
          file_path: path,
          skipped_tables: inaccessibleTables,
        });

        await logServiceExecution({
          service: 'backup-service',
          action: 'backupDatabase',
          stage: 'success',
          startedAt,
          metadata: {
            actorId: actor.id,
            backupId: log.id,
            size: bytes.byteLength,
            skippedTables: inaccessibleTables.length,
          },
        });

        return completedLog;
      } catch (error) {
        await updateBackupLog(log.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: error instanceof Error ? error.message : 'Database backup failed',
        }).catch(() => undefined);

        await logServiceExecution({
          service: 'backup-service',
          action: 'backupDatabase',
          stage: 'failure',
          startedAt,
          metadata: {
            actorId: actor.id,
            backupId: log.id,
          },
        });
        throw handleServiceError('backup-service', 'backupDatabase', error, { actorId: actor.id, backupId: log.id });
      }
    });
  },

  async backupStorage(actor: BackupActor) {
    assertBackupActor(actor.role);

    return withOperationLock('backup:storage', async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'backup-service',
        action: 'backupStorage',
        stage: 'start',
        startedAt,
        metadata: { actorId: actor.id },
      });

      const log = await createBackupLog('storage', `Storage backup started by ${actor.email || actor.id}`);

      try {
        const buckets: Record<string, StorageManifestFile[]> = {};

        for (const bucket of STORAGE_BUCKETS) {
          const files = await listStorageRecursive(bucket);
          const copiedFiles: StorageManifestFile[] = [];

          for (const file of files) {
            const backupPath = await copyStorageFileToBackup({
              sourceBucket: bucket,
              sourcePath: file.name,
              backupId: log.id,
            });

            if (backupPath) {
              copiedFiles.push({
                bucket,
                path: file.name,
                backupPath,
                size: file.metadata?.size || null,
                updatedAt: file.updated_at || null,
              });
            }
          }

          buckets[bucket] = copiedFiles;
        }

        const snapshot: StorageBackupSnapshot = {
          backupId: log.id,
          type: 'storage',
          generatedAt: new Date().toISOString(),
          buckets,
        };

        const bytes = jsonBytes(snapshot);
        const path = `${BACKUP_ROOTS.STORAGE}/${log.id}/manifest.json`;
        await uploadBackupFile({
          path,
          bytes,
          contentType: 'application/octet-stream', // Use octet-stream to avoid MIME type restrictions
        });

        const totalBytes = Object.values(buckets)
          .flat()
          .reduce((sum, file) => sum + (file.size || 0), 0);

        const completedLog = await updateBackupLog(log.id, {
          status: 'completed',
          file_url: path,
          completed_at: new Date().toISOString(),
          size: totalBytes + bytes.byteLength,
          notes: 'Storage backup completed successfully',
        });

        await activity(actor, 'backup_storage_created', log.id, {
          backup_type: 'storage',
          file_path: path,
          buckets: Object.keys(buckets),
        });

        await logServiceExecution({
          service: 'backup-service',
          action: 'backupStorage',
          stage: 'success',
          startedAt,
          metadata: {
            actorId: actor.id,
            backupId: log.id,
            totalBytes,
          },
        });

        return completedLog;
      } catch (error) {
        await updateBackupLog(log.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: error instanceof Error ? error.message : 'Storage backup failed',
        }).catch(() => undefined);

        await logServiceExecution({
          service: 'backup-service',
          action: 'backupStorage',
          stage: 'failure',
          startedAt,
          metadata: {
            actorId: actor.id,
            backupId: log.id,
          },
        });
        throw handleServiceError('backup-service', 'backupStorage', error, { actorId: actor.id, backupId: log.id });
      }
    });
  },

  async backupFullSystem(actor: BackupActor) {
    assertBackupActor(actor.role);

    return withOperationLock('backup:full', async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'backup-service',
        action: 'backupFullSystem',
        stage: 'start',
        startedAt,
        metadata: { actorId: actor.id },
      });

      const log = await createBackupLog('full', `Full system backup started by ${actor.email || actor.id}`);

      try {
        const [databaseLog, storageLog] = await Promise.all([
          this.backupDatabase(actor),
          this.backupStorage(actor),
        ]);

        const snapshot: FullBackupSnapshot = {
          backupId: log.id,
          type: 'full',
          generatedAt: new Date().toISOString(),
          databasePath: databaseLog.file_url || '',
          storagePath: storageLog.file_url || '',
        };

        const bytes = jsonBytes(snapshot);
        const path = `${BACKUP_ROOTS.FULL}/${log.id}-${timestampKey()}.json`;
        await uploadBackupFile({
          path,
          bytes,
          contentType: 'application/octet-stream', // Use octet-stream to avoid MIME type restrictions
        });

        const completedLog = await updateBackupLog(log.id, {
          status:
            databaseLog.status === 'failed' || storageLog.status === 'failed'
              ? 'failed'
              : databaseLog.status === 'partial' || storageLog.status === 'partial'
                ? 'partial'
                : 'completed',
          file_url: path,
          completed_at: new Date().toISOString(),
          size: (databaseLog.size || 0) + (storageLog.size || 0) + bytes.byteLength,
          notes: `Includes database backup ${databaseLog.id} and storage backup ${storageLog.id}`,
        });

        await activity(actor, 'backup_full_created', log.id, {
          backup_type: 'full',
          file_path: path,
          database_backup_id: databaseLog.id,
          storage_backup_id: storageLog.id,
        });

        await notifyOwners(`Full system backup completed by ${actor.email || actor.id}`);

        await logServiceExecution({
          service: 'backup-service',
          action: 'backupFullSystem',
          stage: 'success',
          startedAt,
          metadata: {
            actorId: actor.id,
            backupId: log.id,
            databaseBackupId: databaseLog.id,
            storageBackupId: storageLog.id,
          },
        });

        return completedLog;
      } catch (error) {
        await updateBackupLog(log.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: error instanceof Error ? error.message : 'Full backup failed',
        }).catch(() => undefined);

        await logServiceExecution({
          service: 'backup-service',
          action: 'backupFullSystem',
          stage: 'failure',
          startedAt,
          metadata: {
            actorId: actor.id,
            backupId: log.id,
          },
        });
        throw handleServiceError('backup-service', 'backupFullSystem', error, { actorId: actor.id, backupId: log.id });
      }
    });
  },

  async verifyBackup(log: BackupLog) {
    assertBackupActor('admin');

    return withOperationLock(`backup:verify:${log.id}`, async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'backup-service',
        action: 'verifyBackup',
        stage: 'start',
        startedAt,
        metadata: {
          backupId: log.id,
          backupType: log.backup_type,
        },
      });

      try {
        if (!log.file_url) {
          throw new Error('Backup file is missing');
        }

        const downloadRes = await supabase.storage.from(DOCUMENT_BUCKET).download(log.file_url);
        if (downloadRes.error) throw new Error(downloadRes.error.message);

        const text = await downloadRes.data.text();
        const parsed = JSON.parse(text) as Record<string, unknown>;

        const status = parsed ? 'verified' : 'failed';
        const updatedLog = await updateBackupLog(log.id, {
          status,
          completed_at: new Date().toISOString(),
          notes: status === 'verified' ? 'Backup verified successfully' : 'Backup verification failed',
        });

        await logSystemEvent({
          level: 'info',
          service: 'backup-service',
          action: 'verifyBackup',
          message: `Backup ${log.id} verified`,
          metadata: {
            backupType: log.backup_type,
          },
        });

        await logServiceExecution({
          service: 'backup-service',
          action: 'verifyBackup',
          stage: 'success',
          startedAt,
          metadata: {
            backupId: log.id,
            backupType: log.backup_type,
          },
        });

        return updatedLog;
      } catch (error) {
        await updateBackupLog(log.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: error instanceof Error ? error.message : 'Backup verification failed',
        }).catch(() => undefined);

        await logServiceExecution({
          service: 'backup-service',
          action: 'verifyBackup',
          stage: 'failure',
          startedAt,
          metadata: {
            backupId: log.id,
            backupType: log.backup_type,
          },
        });
        throw handleServiceError('backup-service', 'verifyBackup', error, { backupId: log.id });
      }
    });
  },

  async restoreBackup(log: BackupLog, actor: BackupActor) {
    assertBackupActor(actor.role);

    return withOperationLock(`backup:restore:${log.id}`, async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'backup-service',
        action: 'restoreBackup',
        stage: 'start',
        startedAt,
        metadata: {
          backupId: log.id,
          actorId: actor.id,
          backupType: log.backup_type,
        },
      });

      try {
        if (!log.file_url) {
          throw new Error('Backup file is missing');
        }

        const downloadRes = await supabase.storage.from(DOCUMENT_BUCKET).download(log.file_url);
        if (downloadRes.error) throw new Error(downloadRes.error.message);

        const text = await downloadRes.data.text();
        const parsed = JSON.parse(text) as DatabaseBackupSnapshot | StorageBackupSnapshot | FullBackupSnapshot;

        if (parsed.type === 'database') {
          await restoreDatabaseSnapshotFromPath(log.file_url);
        }

        if (parsed.type === 'storage') {
          await restoreStorageSnapshotFromPath(log.file_url);
        }

        if (parsed.type === 'full') {
          await restoreDatabaseSnapshotFromPath(parsed.databasePath);
          await restoreStorageSnapshotFromPath(parsed.storagePath);
        }

        const updatedLog = await updateBackupLog(log.id, {
          status: 'restored',
          completed_at: new Date().toISOString(),
          notes: `Backup restored by ${actor.email || actor.id}`,
        });

        await activity(actor, 'backup_restored', log.id, {
          backup_type: log.backup_type,
          file_path: log.file_url,
        });

        await logServiceExecution({
          service: 'backup-service',
          action: 'restoreBackup',
          stage: 'success',
          startedAt,
          metadata: {
            backupId: log.id,
            actorId: actor.id,
            backupType: log.backup_type,
          },
        });

        return updatedLog;
      } catch (error) {
        await logServiceExecution({
          service: 'backup-service',
          action: 'restoreBackup',
          stage: 'failure',
          startedAt,
          metadata: {
            backupId: log.id,
            actorId: actor.id,
            backupType: log.backup_type,
          },
        });
        throw handleServiceError('backup-service', 'restoreBackup', error, {
          backupId: log.id,
          actorId: actor.id,
          backupType: log.backup_type,
        });
      }
    });
  },

  async downloadBackup(log: BackupLog) {
    if (!log.file_url) {
      throw new Error('Backup file is missing');
    }
    return createSignedDocumentUrl(log.file_url);
  },

  async runMonthlyBackup(actor: BackupActor) {
    const result = await this.backupFullSystem(actor);
    await notifyOwners(`Monthly full backup completed for ${new Date().toLocaleDateString('id-ID')}`);
    return result;
  },
};
