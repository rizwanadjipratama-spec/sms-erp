// ============================================================================
// CMS SERVICE — Content management for website sections
// ============================================================================

import { cmsDb, storageDb, activityLogsDb } from '@/lib/db';
import type { CmsSection, CmsMedia, CmsPartner, CmsSolution, EmployeeOfMonth, Actor } from '@/types/types';

export const cmsService = {
  // ------- Sections -------
  async getSections(): Promise<CmsSection[]> {
    return cmsDb.getSections();
  },

  async getSection(key: string): Promise<CmsSection | null> {
    return cmsDb.getSection(key);
  },

  async updateSection(id: string, updates: Partial<CmsSection>, actor?: Actor): Promise<CmsSection> {
    const section = await cmsDb.updateSection(id, {
      ...updates,
      updated_by: actor?.id,
    });

    if (actor) {
      await activityLogsDb.create({
        user_id: actor.id,
        user_email: actor.email,
        action: 'update_cms_section',
        entity_type: 'cms_section',
        entity_id: id,
      });
    }

    return section;
  },

  async updateSectionImage(id: string, file: File, actor?: Actor): Promise<CmsSection> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `sections/${id}/${crypto.randomUUID()}.${ext}`;
    const imageUrl = await storageDb.upload('cms-media', path, file);
    return this.updateSection(id, { image_url: imageUrl }, actor);
  },

  async updateSectionVideo(id: string, file: File, actor?: Actor): Promise<CmsSection> {
    const ext = file.name.split('.').pop() ?? 'mp4';
    const path = `sections/${id}/${crypto.randomUUID()}.${ext}`;
    const videoUrl = await storageDb.upload('cms-media', path, file);
    return this.updateSection(id, { video_url: videoUrl }, actor);
  },

  // ------- Media -------
  async getMedia(sectionId?: string): Promise<CmsMedia[]> {
    return cmsDb.getMedia(sectionId);
  },

  // ------- Partners -------
  async getPartners(): Promise<CmsPartner[]> {
    return cmsDb.getPartners();
  },

  // ------- Solutions -------
  async getSolutions(): Promise<CmsSolution[]> {
    return cmsDb.getSolutions();
  },

  async getSolution(slug: string): Promise<CmsSolution | null> {
    return cmsDb.getSolution(slug);
  },

  // ------- Employee of the Month -------
  async getEmployeeOfMonth(): Promise<EmployeeOfMonth | null> {
    return cmsDb.getEmployeeOfMonth();
  },
};
