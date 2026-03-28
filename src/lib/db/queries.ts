// ============================================================================
// CENTRALIZED DATABASE QUERIES
// All Supabase calls go through here — no direct DB calls from UI or services
// ============================================================================

import { supabase } from './client';
import type {
  Profile, Product, PriceList, DbRequest, RequestItem,
  Invoice, PaymentPromise, DeliveryLog, InventoryLog,
  Issue, MonthlyClosing, Notification, ChatChannel,
  ChatChannelMember, ChatMessage, CmsSection, CmsMedia,
  CmsPartner, CmsSolution, EmployeeOfMonth, ActivityLog,
  SystemLog, BackupLog, AutomationEvent,
  PaginationParams, PaginatedResult, UserRole, RequestStatus,
  InvoiceStatus, IssueStatus, NotificationType,
} from '@/types/types';

// ============================================================================
// HELPERS
// ============================================================================

function paginate<T>(query: ReturnType<typeof supabase.from>, params?: PaginationParams) {
  if (!params) return query;
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  return query.range(from, to);
}

function throwOnError<T>(result: { data: T | null; error: { message: string } | null; count?: number | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ============================================================================
// PROFILES
// ============================================================================

export const profilesDb = {
  async getById(id: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  },

  async getByEmail(email: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    return data;
  },

  async getByRole(role: UserRole): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role)
      .eq('is_active', true);
    return data ?? [];
  },

  async getByRoles(roles: UserRole[]): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', roles)
      .eq('is_active', true);
    return data ?? [];
  },

  async getAll(pagination?: PaginationParams): Promise<{ data: Profile[]; count: number }> {
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async upsert(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    return throwOnError(
      await supabase
        .from('profiles')
        .upsert({ ...profile, updated_at: new Date().toISOString() })
        .select('*')
        .single()
    );
  },

  async update(id: string, updates: Partial<Profile>): Promise<Profile> {
    return throwOnError(
      await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

// ============================================================================
// PRODUCTS
// ============================================================================

export const productsDb = {
  async getAll(options?: { onlyPriced?: boolean; onlyActive?: boolean; pagination?: PaginationParams }): Promise<{ data: Product[]; count: number }> {
    let query = supabase
      .from('products')
      .select('*, price:price_list!left(id, product_id, price_regular, price_kso, is_active)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.onlyActive !== false) query = query.eq('is_active', true);
    if (options?.onlyPriced) query = query.eq('is_priced', true);
    if (options?.pagination) query = paginate(query, options.pagination) as typeof query;

    const result = await query;
    const products = (result.data ?? []).map(p => ({
      ...p,
      price: Array.isArray(p.price)
        ? p.price.find((pr: PriceList) => pr.is_active) ?? p.price[0] ?? undefined
        : p.price ?? undefined,
    }));
    return { data: products, count: result.count ?? 0 };
  },

  async getById(id: string): Promise<Product | null> {
    const { data } = await supabase
      .from('products')
      .select('*, price:price_list!left(id, product_id, price_regular, price_kso, is_active)')
      .eq('id', id)
      .single();
    if (!data) return null;
    return {
      ...data,
      price: Array.isArray(data.price)
        ? data.price.find((pr: PriceList) => pr.is_active) ?? data.price[0] ?? undefined
        : data.price ?? undefined,
    };
  },

  async getByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return [];
    const { data } = await supabase
      .from('products')
      .select('*, price:price_list!left(id, product_id, price_regular, price_kso, is_active)')
      .in('id', ids);
    return (data ?? []).map(p => ({
      ...p,
      price: Array.isArray(p.price)
        ? p.price.find((pr: PriceList) => pr.is_active) ?? p.price[0] ?? undefined
        : p.price ?? undefined,
    }));
  },

  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_priced' | 'price'>): Promise<Product> {
    return throwOnError(
      await supabase.from('products').insert(product).select('*').single()
    );
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const { price, ...dbUpdates } = updates as Partial<Product> & { price?: unknown };
    return throwOnError(
      await supabase
        .from('products')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },

  async delete(id: string): Promise<void> {
    throwOnError(await supabase.from('products').delete().eq('id', id));
  },

  async decrementStock(productId: string, qty: number): Promise<number> {
    const { data, error } = await supabase.rpc('decrement_stock', {
      p_product_id: productId,
      p_qty: qty,
    });
    if (error) throw new Error(error.message);
    return data as number;
  },

  async incrementStock(productId: string, qty: number): Promise<number> {
    const { data, error } = await supabase.rpc('increment_stock', {
      p_product_id: productId,
      p_qty: qty,
    });
    if (error) throw new Error(error.message);
    return data as number;
  },
};

// ============================================================================
// PRICE LIST
// ============================================================================

export const priceListDb = {
  async getByProduct(productId: string): Promise<PriceList | null> {
    const { data } = await supabase
      .from('price_list')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();
    return data;
  },

  async upsert(price: Partial<PriceList> & { product_id: string }): Promise<PriceList> {
    return throwOnError(
      await supabase
        .from('price_list')
        .upsert({
          ...price,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })
        .select('*')
        .single()
    );
  },

  async getAll(): Promise<PriceList[]> {
    const { data } = await supabase
      .from('price_list')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// REQUESTS
// ============================================================================

export const requestsDb = {
  async getById(id: string): Promise<DbRequest | null> {
    const { data } = await supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit))')
      .eq('id', id)
      .single();
    return data;
  },

  async getByUser(userId: string, pagination?: PaginationParams): Promise<{ data: DbRequest[]; count: number }> {
    let query = supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit))', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async getByStatus(status: RequestStatus | RequestStatus[], pagination?: PaginationParams): Promise<{ data: DbRequest[]; count: number }> {
    const statuses = Array.isArray(status) ? status : [status];
    let query = supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit))', { count: 'exact' })
      .in('status', statuses)
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async getAll(pagination?: PaginationParams): Promise<{ data: DbRequest[]; count: number }> {
    let query = supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit))', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async create(request: Omit<DbRequest, 'id' | 'created_at' | 'updated_at' | 'request_items' | 'profiles'>): Promise<DbRequest> {
    return throwOnError(
      await supabase.from('requests').insert(request).select('*').single()
    );
  },

  async update(id: string, updates: Partial<DbRequest>): Promise<DbRequest> {
    const { request_items, profiles, ...dbUpdates } = updates as DbRequest;
    return throwOnError(
      await supabase
        .from('requests')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },

  async createItems(items: Omit<RequestItem, 'id' | 'created_at' | 'updated_at'>[]): Promise<RequestItem[]> {
    return throwOnError(
      await supabase.from('request_items').insert(items).select('*')
    );
  },
};

// ============================================================================
// INVOICES
// ============================================================================

export const invoicesDb = {
  async getByOrderId(orderId: string): Promise<Invoice | null> {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', orderId)
      .limit(1)
      .single();
    return data;
  },

  async getAll(filters?: { status?: InvoiceStatus[] }, pagination?: PaginationParams): Promise<{ data: Invoice[]; count: number }> {
    let query = supabase
      .from('invoices')
      .select('*, request:requests!left(id, user_id, user_email, status)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (filters?.status?.length) query = query.in('status', filters.status);
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async create(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'request'>): Promise<Invoice> {
    return throwOnError(
      await supabase.from('invoices').insert(invoice).select('*').single()
    );
  },

  async update(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    const { request, ...dbUpdates } = updates as Invoice;
    return throwOnError(
      await supabase
        .from('invoices')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },

  async generateNumber(): Promise<string> {
    const { data, error } = await supabase.rpc('generate_invoice_number');
    if (error) throw new Error(error.message);
    return data as string;
  },

  async countByOrder(orderId: string): Promise<number> {
    const { count, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
};

// ============================================================================
// PAYMENT PROMISES
// ============================================================================

export const paymentPromisesDb = {
  async create(promise: Omit<PaymentPromise, 'id' | 'created_at' | 'updated_at' | 'fulfilled' | 'fulfilled_at'>): Promise<PaymentPromise> {
    return throwOnError(
      await supabase.from('payment_promises').insert(promise).select('*').single()
    );
  },

  async getByUser(userId: string): Promise<PaymentPromise[]> {
    const { data } = await supabase
      .from('payment_promises')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// DELIVERY LOGS
// ============================================================================

export const deliveryLogsDb = {
  async create(log: Omit<DeliveryLog, 'id' | 'created_at' | 'updated_at' | 'technician'>): Promise<DeliveryLog> {
    return throwOnError(
      await supabase.from('delivery_logs').insert(log).select('*').single()
    );
  },

  async getByOrder(orderId: string): Promise<DeliveryLog[]> {
    const { data } = await supabase
      .from('delivery_logs')
      .select('*, technician:profiles!technician_id(name, email)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getByTechnician(technicianId: string): Promise<DeliveryLog[]> {
    const { data } = await supabase
      .from('delivery_logs')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getAll(pagination?: PaginationParams): Promise<{ data: DeliveryLog[]; count: number }> {
    let query = supabase
      .from('delivery_logs')
      .select('*, technician:profiles!technician_id(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },
};

// ============================================================================
// INVENTORY LOGS
// ============================================================================

export const inventoryLogsDb = {
  async create(log: Omit<InventoryLog, 'id' | 'created_at' | 'product'>): Promise<InventoryLog> {
    return throwOnError(
      await supabase.from('inventory_logs').insert(log).select('*').single()
    );
  },

  async getRecent(limit: number = 50): Promise<InventoryLog[]> {
    const { data } = await supabase
      .from('inventory_logs')
      .select('*, product:products!product_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async getByProduct(productId: string): Promise<InventoryLog[]> {
    const { data } = await supabase
      .from('inventory_logs')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// ISSUES
// ============================================================================

export const issuesDb = {
  async create(issue: Omit<Issue, 'id' | 'created_at' | 'updated_at'>): Promise<Issue> {
    return throwOnError(
      await supabase.from('issues').insert(issue).select('*').single()
    );
  },

  async getByUser(userId: string): Promise<Issue[]> {
    const { data } = await supabase
      .from('issues')
      .select('*')
      .eq('reported_by', userId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getByStatus(status: IssueStatus | IssueStatus[]): Promise<Issue[]> {
    const statuses = Array.isArray(status) ? status : [status];
    const { data } = await supabase
      .from('issues')
      .select('*')
      .in('status', statuses)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async update(id: string, updates: Partial<Issue>): Promise<Issue> {
    return throwOnError(
      await supabase
        .from('issues')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },

  async getAll(): Promise<Issue[]> {
    const { data } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// MONTHLY CLOSING
// ============================================================================

export const monthlyClosingDb = {
  async upsert(closing: Omit<MonthlyClosing, 'id' | 'created_at' | 'updated_at'>): Promise<MonthlyClosing> {
    return throwOnError(
      await supabase
        .from('monthly_closing')
        .upsert(closing, { onConflict: 'year,month' })
        .select('*')
        .single()
    );
  },

  async getAll(): Promise<MonthlyClosing[]> {
    const { data } = await supabase
      .from('monthly_closing')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notificationsDb = {
  async getByUser(userId: string, pagination?: PaginationParams): Promise<{ data: Notification[]; count: number }> {
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async create(notification: Omit<Notification, 'id' | 'created_at' | 'read' | 'read_at'>): Promise<Notification> {
    return throwOnError(
      await supabase.from('notifications').insert(notification).select('*').single()
    );
  },

  async createMany(notifications: Omit<Notification, 'id' | 'created_at' | 'read' | 'read_at'>[]): Promise<void> {
    if (!notifications.length) return;
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw new Error(error.message);
  },

  async markRead(id: string, userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
  },

  async markAllRead(userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
  },
};

// ============================================================================
// CHAT
// ============================================================================

export const chatDb = {
  async getChannels(userId: string): Promise<(ChatChannel & { unread_count?: number })[]> {
    const { data } = await supabase
      .from('chat_channel_members')
      .select('channel_id, last_read_at, channel:chat_channels(*)')
      .eq('user_id', userId);

    return (data ?? []).map(m => ({
      ...(m.channel as unknown as ChatChannel),
      last_read_at: m.last_read_at,
    }));
  },

  async getMessages(channelId: string, pagination?: PaginationParams): Promise<{ data: ChatMessage[]; count: number }> {
    let query = supabase
      .from('chat_messages')
      .select('*, sender:profiles!sender_id(name, email, avatar_url, role)', { count: 'exact' })
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: (result.data ?? []).reverse(), count: result.count ?? 0 };
  },

  async sendMessage(msg: { channel_id: string; sender_id: string; content: string; file_url?: string; file_name?: string; file_type?: string; reply_to?: string }): Promise<ChatMessage> {
    return throwOnError(
      await supabase.from('chat_messages').insert(msg).select('*, sender:profiles!sender_id(name, email, avatar_url, role)').single()
    );
  },

  async updateLastRead(channelId: string, userId: string): Promise<void> {
    await supabase
      .from('chat_channel_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('unread_chat_count', { p_user_id: userId });
    if (error) return 0;
    return (data as number) ?? 0;
  },
};

// ============================================================================
// CMS
// ============================================================================

export const cmsDb = {
  async getSections(): Promise<CmsSection[]> {
    const { data } = await supabase
      .from('cms_sections')
      .select('*')
      .order('sort_order');
    return data ?? [];
  },

  async getSection(key: string): Promise<CmsSection | null> {
    const { data } = await supabase
      .from('cms_sections')
      .select('*')
      .eq('section_key', key)
      .single();
    return data;
  },

  async updateSection(id: string, updates: Partial<CmsSection>): Promise<CmsSection> {
    return throwOnError(
      await supabase
        .from('cms_sections')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },

  async getMedia(sectionId?: string): Promise<CmsMedia[]> {
    let query = supabase.from('cms_media').select('*').eq('is_active', true).order('sort_order');
    if (sectionId) query = query.eq('section_id', sectionId);
    const { data } = await query;
    return data ?? [];
  },

  async getPartners(): Promise<CmsPartner[]> {
    const { data } = await supabase
      .from('cms_partners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  },

  async getSolutions(): Promise<CmsSolution[]> {
    const { data } = await supabase
      .from('cms_solutions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  },

  async getSolution(slug: string): Promise<CmsSolution | null> {
    const { data } = await supabase
      .from('cms_solutions')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    return data;
  },

  async getEmployeeOfMonth(): Promise<EmployeeOfMonth | null> {
    const { data } = await supabase
      .from('employee_of_month')
      .select('*, profile:profiles!user_id(name, email, role)')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .single();
    return data;
  },
};

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export const activityLogsDb = {
  async create(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
    await supabase.from('activity_logs').insert(log);
  },

  async getRecent(limit: number = 50): Promise<ActivityLog[]> {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// SYSTEM LOGS
// ============================================================================

export const systemLogsDb = {
  async create(log: Omit<SystemLog, 'id' | 'created_at'>): Promise<void> {
    await supabase.from('system_logs').insert(log);
  },

  async getRecent(limit: number = 100): Promise<SystemLog[]> {
    const { data } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },
};

// ============================================================================
// STORAGE
// ============================================================================

export const storageDb = {
  async upload(bucket: string, path: string, file: File): Promise<string> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async delete(bucket: string, paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(error.message);
  },

  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },
};

// ============================================================================
// ANALYTICS (uses views for performance)
// ============================================================================

export const analyticsDb = {
  async getMonthlyRevenue(): Promise<{ month: string; invoice_count: number; total_revenue: number; total_tax: number; paid_count: number; unpaid_count: number }[]> {
    const { data } = await supabase
      .from('v_monthly_revenue')
      .select('*')
      .order('month', { ascending: false })
      .limit(12);
    return data ?? [];
  },

  async getOrderPipeline(): Promise<{ status: string; order_count: number; total_value: number; avg_hours_in_status: number }[]> {
    const { data } = await supabase
      .from('v_order_pipeline')
      .select('*');
    return data ?? [];
  },

  async getProductPerformance(limit: number = 20): Promise<{ id: string; name: string; category: string; stock: number; total_ordered: number; total_revenue: number; order_count: number }[]> {
    const { data } = await supabase
      .from('v_product_performance')
      .select('*')
      .order('total_revenue', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async getTechnicianPerformance(): Promise<{ technician_id: string; technician_name: string; total_deliveries: number; successful_deliveries: number; avg_delivery_hours: number }[]> {
    const { data } = await supabase
      .from('v_technician_performance')
      .select('*');
    return data ?? [];
  },
};
