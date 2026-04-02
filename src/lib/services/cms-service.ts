import { supabase } from '../supabase';
import type { CmsSettings, CmsNews, CmsEvent, CmsPartner, CmsSolution } from '@/types/types';

function throwOnError<T>(result: { data: T | null; error: any }, fallback?: any): T {
  if (result.error) {
    if (String(result.error).includes('Failed to fetch') && fallback !== undefined) {
      console.warn('CMS Network fetch failed, using fallback data');
      return fallback as T;
    }
    throw new Error(result.error.message);
  }
  return (result.data || fallback) as T;
}

export const cmsService = {
  // ============================================================================
  // SETTINGS (SINGLETON)
  // ============================================================================

  async getSettings(): Promise<CmsSettings | null> {
    try {
      const { data, error } = await supabase
        .from('cms_settings')
        .select('*, employee_of_month:profiles!employee_of_month_id(name, email, role, avatar_url, quotes, avg_rating)')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    } catch (err: any) {
      console.warn('getSettings error:', err?.message || String(err));
      return null;
    }
  },

  async updateSettings(updates: Partial<CmsSettings>): Promise<CmsSettings> {
    const { employee_of_month, updated_at, ...cleanUpdates } = updates as any;
    return throwOnError(
      await supabase
        .from('cms_settings')
        .upsert({ id: 1, ...cleanUpdates })
        .select('*')
        .single()
    );
  },

  // ============================================================================
  // NEWS
  // ============================================================================

  async getNews(publishedOnly = false): Promise<CmsNews[]> {
    let query = supabase
      .from('cms_news')
      .select('*, creator:profiles!created_by(name, email)')
      .order('created_at', { ascending: false });

    if (publishedOnly) {
      query = query.eq('is_published', true);
    }

    return throwOnError(await query, []) as CmsNews[];
  },

  async createNews(news: Partial<CmsNews>): Promise<CmsNews> {
    return throwOnError(
      await supabase.from('cms_news').insert(news).select('*').single()
    );
  },

  async updateNews(id: string, updates: Partial<CmsNews>): Promise<CmsNews> {
    const { creator, ...cleanUpdates } = updates as any;
    return throwOnError(
      await supabase.from('cms_news').update(cleanUpdates).eq('id', id).select('*').single()
    );
  },

  async deleteNews(id: string): Promise<void> {
    const { error } = await supabase.from('cms_news').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ============================================================================
  // EVENTS
  // ============================================================================

  async getEvents(): Promise<CmsEvent[]> {
    const query = supabase
      .from('cms_events')
      .select('*, creator:profiles!created_by(name, email)')
      .order('event_date', { ascending: true });
    return throwOnError(await query, []) as CmsEvent[];
  },

  async createEvent(event: Partial<CmsEvent>): Promise<CmsEvent> {
    return throwOnError(
      await supabase.from('cms_events').insert(event).select('*').single()
    );
  },

  async updateEvent(id: string, updates: Partial<CmsEvent>): Promise<CmsEvent> {
    const { creator, ...cleanUpdates } = updates as any;
    return throwOnError(
      await supabase.from('cms_events').update(cleanUpdates).eq('id', id).select('*').single()
    );
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('cms_events').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ============================================================================
  // PARTNERS (Existing schema)
  // ============================================================================

  async getPartners(): Promise<CmsPartner[]> {
    const query = supabase
      .from('cms_partners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return throwOnError(await query, []) as CmsPartner[];
  },

  async createPartner(partner: Partial<CmsPartner>): Promise<CmsPartner> {
    return throwOnError(
      await supabase.from('cms_partners').insert({ ...partner, is_active: true }).select('*').single()
    );
  },

  async updatePartner(id: string, updates: Partial<CmsPartner>): Promise<CmsPartner> {
    return throwOnError(
      await supabase.from('cms_partners').update(updates).eq('id', id).select('*').single()
    );
  },

  async deletePartner(id: string): Promise<void> {
    const { error } = await supabase.from('cms_partners').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ============================================================================
  // SOLUTIONS (Catalog)
  // ============================================================================

  async getSolutions(): Promise<CmsSolution[]> {
    const query = supabase
      .from('cms_solutions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return throwOnError(await query, []) as CmsSolution[];
  },

  async createSolution(solution: Partial<CmsSolution>): Promise<CmsSolution> {
    return throwOnError(
      await supabase.from('cms_solutions').insert({ ...solution, is_active: true }).select('*').single()
    );
  },

  async updateSolution(id: string, updates: Partial<CmsSolution>): Promise<CmsSolution> {
    return throwOnError(
      await supabase.from('cms_solutions').update(updates).eq('id', id).select('*').single()
    );
  },

  async deleteSolution(id: string): Promise<void> {
    const { error } = await supabase.from('cms_solutions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ============================================================================
  // ASSETS
  // ============================================================================

  async uploadCmsAsset(file: File, folder = 'general'): Promise<string> {
    const ext = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('cms-assets')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from('cms-assets').getPublicUrl(fileName);
    return data.publicUrl;
  }
};
