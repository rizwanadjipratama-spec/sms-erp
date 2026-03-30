// ============================================================================
// PREVENTIVE MAINTENANCE SERVICE
// Created by: Antigravity
// ============================================================================

import {
  equipmentAssetsDb, pmSchedulesDb, activityLogsDb, storageDb
} from '@/lib/db';
import type {
  Actor, EquipmentAsset, PmSchedule, PmStatus, UserRole
} from '@/types/types';

const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

export const pmService = {
  // ── Asset Management ───────────────────────────────────────────────────

  async createAsset(
    data: Omit<EquipmentAsset, 'id' | 'created_at' | 'updated_at' | 'client' | 'area' | 'product'>,
    actor: Actor
  ): Promise<EquipmentAsset> {
    const asset = await equipmentAssetsDb.create(data);

    // Auto-generate the first PM schedule based on installation date or current date
    const baseDate = data.installation_date ? new Date(data.installation_date) : new Date();
    await this.generateNextPm(asset, baseDate);

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'create_equipment_asset',
      entity_type: 'equipment_asset',
      entity_id: asset.id,
      metadata: { serial_number: asset.serial_number }
    });

    return asset;
  },

  async updateAsset(id: string, updates: Partial<EquipmentAsset>, actor: Actor): Promise<EquipmentAsset> {
    const updated = await equipmentAssetsDb.update(id, updates);
    
    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'update_equipment_asset',
      entity_type: 'equipment_asset',
      entity_id: id,
    });

    return updated;
  },

  async getClientAssets(clientId: string): Promise<EquipmentAsset[]> {
    return equipmentAssetsDb.getByClient(clientId);
  },

  async getAllAssets(): Promise<EquipmentAsset[]> {
    return equipmentAssetsDb.getAll();
  },

  // ── Schedule Generators ────────────────────────────────────────────────

  async generateNextPm(asset: EquipmentAsset, baseDate: Date): Promise<PmSchedule | null> {
    if (asset.pm_frequency_months <= 0 || asset.status !== 'active') return null;

    const dueDate = new Date(baseDate);
    dueDate.setMonth(dueDate.getMonth() + asset.pm_frequency_months);

    // Provide localized ISO string (YYYY-MM-DD)
    const dueDateStr = dueDate.toISOString().split('T')[0];

    return pmSchedulesDb.create({
      asset_id: asset.id,
      due_date: dueDateStr,
      status: 'pending',
      photo_urls: [],
    });
  },

  // ── Schedule Management ────────────────────────────────────────────────

  async getUpcomingPms(technicianId?: string, areaIds?: string[]): Promise<PmSchedule[]> {
    return pmSchedulesDb.getUpcoming(technicianId, areaIds);
  },

  async getClientPms(clientId: string): Promise<PmSchedule[]> {
    return pmSchedulesDb.getByClient(clientId);
  },

  async getAssetPms(assetId: string): Promise<PmSchedule[]> {
    return pmSchedulesDb.getByAsset(assetId);
  },

  async updatePmStatus(id: string, status: PmStatus, actor: Actor): Promise<PmSchedule> {
    const schedule = await pmSchedulesDb.getById(id);
    if (!schedule) throw new Error('PM Schedule not found');

    const updated = await pmSchedulesDb.update(id, { status });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'update_pm_status',
      entity_type: 'pm_schedule',
      entity_id: id,
      metadata: { from: schedule.status, to: status }
    });

    return updated;
  },

  async claimPm(id: string, actor: Actor): Promise<PmSchedule> {
    if (actor.role !== 'technician') throw new Error('Only technicians can claim PMs');
    
    const schedule = await pmSchedulesDb.getById(id);
    if (!schedule) throw new Error('PM Schedule not found');
    if (schedule.technician_id) throw new Error('PM already claimed');

    return pmSchedulesDb.update(id, { technician_id: actor.id, status: 'scheduled' });
  },

  async completePm(
    id: string,
    notes: string,
    photoUrls: string[],
    actor: Actor
  ): Promise<PmSchedule> {
    if (!notes.trim()) throw new Error('Completion notes are required');

    const schedule = await pmSchedulesDb.getById(id);
    if (!schedule) throw new Error('PM Schedule not found');

    const updated = await pmSchedulesDb.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      notes,
      photo_urls: photoUrls,
    });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'complete_pm',
      entity_type: 'pm_schedule',
      entity_id: id,
    });

    // Auto-generate the next PM based on the completion date
    const asset = schedule.asset ? await equipmentAssetsDb.getById(schedule.asset_id) : null;
    if (asset && asset.status === 'active') {
      await this.generateNextPm(asset, new Date());
    }

    return updated;
  },

  // ── Photos ─────────────────────────────────────────────────────────────

  async uploadPmPhoto(file: File, scheduleId: string): Promise<string> {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Allowed: PNG, JPG, JPEG, WEBP');
    }
    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error('File too large. Max: 10MB');
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `pms/${scheduleId}/${crypto.randomUUID()}.${ext}`;
    return storageDb.upload('service-issues', path, file); // reusing same bucket for simplicity
  },
};
