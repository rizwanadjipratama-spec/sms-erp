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
  ChatChannelType,
  CmsPartner, CmsSolution, EmployeeOfMonth, ActivityLog,
  SystemLog, BackupLog, AutomationEvent,
  PaginationParams, PaginatedResult, UserRole, RequestStatus,
  InvoiceStatus, IssueStatus, NotificationType,
  TechnicianArea, AreaTransferRequest, ServiceIssue, ServiceIssueLog,
  EquipmentAsset, PmSchedule, PmStatus,
  FakturTask, FakturTaskStatus, FakturTaskType,
  // ORION types
  Region, Branch, Delivery, DeliveryItem, DeliveryTeamMember,
  DeliveryProof, DeliveryStatusLog, DeliveryStatus,
  Approval, ApprovalStatus, ApprovalType,
  Supplier, PurchaseRequest, PurchaseOrder, PurchaseRequestStatus, PurchaseOrderStatus,
  ExpenseClaim, ExpenseClaimStatus, ClaimLedger, CashAdvance,
  FinancialTransaction, FinancialTransactionType, FinancialDirection,
  ProductBranchStock, StockTransfer, StockTransferLog,
  ClaimPayment, SupplierInvoice, RequestNote,
  RequestStatusLog, StaffRating,
} from '@/types/types';

// ============================================================================
// HELPERS
// ============================================================================

function paginate<T>(query: any, params?: PaginationParams) {
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

  async heartbeat(id: string): Promise<void> {
    await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', id);
  },

  async getActiveUsers(minutesAgo: number = 5): Promise<Profile[]> {
    const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .gte('last_active_at', cutoff)
      .order('last_active_at', { ascending: false });
    return data ?? [];
  },
};

// ============================================================================
// PRODUCTS
// ============================================================================

export const productsDb = {
  async getAll(options?: { onlyPriced?: boolean; onlyActive?: boolean; pagination?: PaginationParams; branchId?: string }): Promise<{ data: Product[]; count: number }> {
    let query = supabase
      .from('products')
      .select('*, price:price_list!left(id, product_id, price_regular, price_kso, price_cost_per_test, is_active)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.onlyActive !== false) query = query.eq('is_active', true);
    if (options?.onlyPriced) query = query.eq('is_priced', true);
    if (options?.branchId && options.branchId !== 'ALL') query = query.eq('branch_id', options.branchId);
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
      .select('*, request_items(*, products(name, image_url, unit)), branch:branches(name, code)')
      .eq('id', id)
      .single();
    return data;
  },

  async getByUser(userId: string, pagination?: PaginationParams): Promise<{ data: DbRequest[]; count: number }> {
    let query = supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit)), branch:branches(name, code)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async getByStatus(status: RequestStatus | RequestStatus[], pagination?: PaginationParams, branchId?: string): Promise<{ data: DbRequest[]; count: number }> {
    const statuses = Array.isArray(status) ? status : [status];
    let query = supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit)), branch:branches(name, code)', { count: 'exact' })
      .in('status', statuses)
      .order('created_at', { ascending: false });
    if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async getAll(pagination?: PaginationParams, branchId?: string): Promise<{ data: DbRequest[]; count: number }> {
    let query = supabase
      .from('requests')
      .select('*, request_items(*, products(name, image_url, unit)), branch:branches(name, code)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
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

  async getAll(filters?: { status?: InvoiceStatus[]; branchId?: string }, pagination?: PaginationParams): Promise<{ data: Invoice[]; count: number }> {
    let query = supabase
      .from('invoices')
      .select('*, request:requests!left(id, user_id, user_email, status)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (filters?.status?.length) query = query.in('status', filters.status);
    if (filters?.branchId && filters.branchId !== 'ALL') query = query.eq('branch_id', filters.branchId);
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
  async create(log: Omit<DeliveryLog, 'id' | 'created_at' | 'updated_at' | 'technician' | 'courier'>): Promise<DeliveryLog> {
    return throwOnError(
      await supabase.from('delivery_logs').insert(log).select('*').single()
    );
  },

  async update(id: string, updates: Partial<Pick<DeliveryLog, 'status' | 'note' | 'proof_url' | 'delivered_at' | 'accompanying_staff'>>): Promise<DeliveryLog> {
    return throwOnError(
      await supabase.from('delivery_logs').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
    );
  },

  async getById(id: string): Promise<DeliveryLog | null> {
    const { data } = await supabase
      .from('delivery_logs')
      .select('*, technician:profiles!delivery_logs_technician_id_fkey(name, email), courier:profiles!delivery_logs_courier_id_fkey(name, email)')
      .eq('id', id)
      .single();
    return data ?? null;
  },

  async getByOrder(orderId: string): Promise<DeliveryLog[]> {
    const { data } = await supabase
      .from('delivery_logs')
      .select('*, technician:profiles!delivery_logs_technician_id_fkey(name, email), courier:profiles!delivery_logs_courier_id_fkey(name, email)')
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

  async getByCourier(courierId: string): Promise<DeliveryLog[]> {
    const { data } = await supabase
      .from('delivery_logs')
      .select('*, courier:profiles!delivery_logs_courier_id_fkey(name, email)')
      .eq('courier_id', courierId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getAll(pagination?: PaginationParams): Promise<{ data: DeliveryLog[]; count: number }> {
    let query = supabase
      .from('delivery_logs')
      .select('*, technician:profiles!delivery_logs_technician_id_fkey(name, email), courier:profiles!delivery_logs_courier_id_fkey(name, email)', { count: 'exact' })
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

  async getRecent(limit: number = 50, branchId?: string): Promise<InventoryLog[]> {
    let query = supabase
      .from('inventory_logs')
      .select('*, product:products!inner(name, branch_id)')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (branchId && branchId !== 'ALL') {
      query = query.eq('products.branch_id', branchId);
    }

    const { data } = await query;
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

  async getByStatus(status: IssueStatus | IssueStatus[], branchId?: string): Promise<Issue[]> {
    const statuses = Array.isArray(status) ? status : [status];
    let query = supabase
      .from('issues')
      .select('*')
      .in('status', statuses)
      .order('created_at', { ascending: false });
    if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
    const { data } = await query;
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

  async getAll(branchId?: string): Promise<Issue[]> {
    let query = supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
    const { data } = await query;
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

  async createChannel(name: string, type: ChatChannelType, description?: string): Promise<ChatChannel> {
    return throwOnError(
      await supabase.from('chat_channels').insert({ name, channel_type: type, description }).select('*').single()
    );
  },

  async deleteChannel(channelId: string): Promise<void> {
    const { error } = await supabase.from('chat_channels').delete().eq('id', channelId);
    if (error) throw new Error(error.message);
  },

  async addMember(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('chat_channel_members').insert({ channel_id: channelId, user_id: userId });
    if (error) throw new Error(error.message);
  },

  async removeMember(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('chat_channel_members').delete().eq('channel_id', channelId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  async searchMessages(channelId: string, query?: string, startDate?: Date, endDate?: Date, pagination?: PaginationParams): Promise<{ data: ChatMessage[]; count: number }> {
    const limit = pagination?.pageSize ?? 50;
    const offset = ((pagination?.page ?? 1) - 1) * limit;
    
    const { data, error } = await supabase.rpc('search_chat_messages', {
      p_channel_id: channelId,
      p_search_query: query || null,
      p_start_date: startDate ? startDate.toISOString() : null,
      p_end_date: endDate ? endDate.toISOString() : null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw new Error(error.message);

    // Map RPC result back to ChatMessage structure matching the regular select
    const mapped = (data as any[]).map(row => ({
      id: row.id,
      channel_id: row.channel_id,
      sender_id: row.sender_id,
      content: row.content,
      file_url: row.file_url,
      file_name: row.file_name,
      file_type: row.file_type,
      is_edited: row.is_edited,
      is_deleted: row.is_deleted,
      reply_to: row.reply_to,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sender: {
        name: row.sender_name,
        email: row.sender_email,
        avatar_url: row.sender_avatar,
        role: row.sender_role
      }
    }));

    // The RPC doesn't return count directly, so we just return the available data and a pseudo count
    return { data: mapped.reverse(), count: mapped.length };
  },

  async getChannelMembers(channelId: string): Promise<string[]> {
    const { data, error } = await supabase.from('chat_channel_members').select('user_id').eq('channel_id', channelId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(m => m.user_id);
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

  async getByUser(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async getAll(limit: number = 500): Promise<ActivityLog[]> {
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

// ============================================================================
// TECHNICIAN AREAS (added by Antigravity)
// ============================================================================

export const technicianAreasDb = {
  async getByTechnician(technicianId: string): Promise<TechnicianArea[]> {
    const { data } = await supabase
      .from('technician_areas')
      .select('*, technician:profiles!technician_id(name, email)')
      .eq('technician_id', technicianId)
      .eq('is_active', true)
      .order('hospital_name');
    return data ?? [];
  },

  async getAll(): Promise<TechnicianArea[]> {
    const { data } = await supabase
      .from('technician_areas')
      .select('*, technician:profiles!technician_id(name, email)')
      .eq('is_active', true)
      .order('hospital_name');
    return data ?? [];
  },

  async getById(id: string): Promise<TechnicianArea | null> {
    const { data } = await supabase
      .from('technician_areas')
      .select('*, technician:profiles!technician_id(name, email)')
      .eq('id', id)
      .single();
    return data;
  },

  async create(area: Omit<TechnicianArea, 'id' | 'created_at' | 'updated_at' | 'technician'>): Promise<TechnicianArea> {
    return throwOnError(
      await supabase.from('technician_areas').insert(area).select('*').single()
    );
  },

  async update(id: string, updates: Partial<TechnicianArea>): Promise<TechnicianArea> {
    const { technician, ...dbUpdates } = updates as TechnicianArea;
    return throwOnError(
      await supabase
        .from('technician_areas')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

// ============================================================================
// AREA TRANSFER REQUESTS (added by Antigravity)
// ============================================================================

export const areaTransfersDb = {
  async create(transfer: Omit<AreaTransferRequest, 'id' | 'created_at' | 'updated_at' | 'area' | 'from_technician' | 'to_technician'>): Promise<AreaTransferRequest> {
    return throwOnError(
      await supabase.from('area_transfer_requests').insert(transfer).select('*').single()
    );
  },

  async getByTechnician(technicianId: string): Promise<AreaTransferRequest[]> {
    const { data } = await supabase
      .from('area_transfer_requests')
      .select('*, area:technician_areas!area_id(area_name, hospital_name), from_technician:profiles!from_technician_id(name, email), to_technician:profiles!to_technician_id(name, email)')
      .or(`from_technician_id.eq.${technicianId},to_technician_id.eq.${technicianId}`)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getPending(technicianId: string): Promise<AreaTransferRequest[]> {
    const { data } = await supabase
      .from('area_transfer_requests')
      .select('*, area:technician_areas!area_id(area_name, hospital_name), from_technician:profiles!from_technician_id(name, email)')
      .eq('to_technician_id', technicianId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async respond(id: string, status: 'accepted' | 'rejected', responseNote?: string): Promise<AreaTransferRequest> {
    return throwOnError(
      await supabase
        .from('area_transfer_requests')
        .update({ status, response_note: responseNote, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

// ============================================================================
// SERVICE ISSUES (added by Antigravity)
// ============================================================================

export const serviceIssuesDb = {
  async create(issue: Omit<ServiceIssue, 'id' | 'created_at' | 'updated_at' | 'reporter' | 'assignee' | 'area' | 'product'>): Promise<ServiceIssue> {
    return throwOnError(
      await supabase.from('service_issues').insert(issue).select('*').single()
    );
  },

  async getById(id: string): Promise<ServiceIssue | null> {
    const { data } = await supabase
      .from('service_issues')
      .select('*, reporter:profiles!reported_by(name, email, company), assignee:profiles!assigned_to(name, email), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name)')
      .eq('id', id)
      .single();
    return data;
  },

  async getByReporter(reporterId: string): Promise<ServiceIssue[]> {
    const { data } = await supabase
      .from('service_issues')
      .select('*, assignee:profiles!assigned_to(name, email), area:technician_areas!area_id(area_name, hospital_name)')
      .eq('reported_by', reporterId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getByAssignee(technicianId: string): Promise<ServiceIssue[]> {
    const { data } = await supabase
      .from('service_issues')
      .select('*, reporter:profiles!reported_by(name, email, company), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name)')
      .eq('assigned_to', technicianId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getByAreas(areaIds: string[]): Promise<ServiceIssue[]> {
    if (!areaIds.length) return [];
    const { data } = await supabase
      .from('service_issues')
      .select('*, reporter:profiles!reported_by(name, email, company), assignee:profiles!assigned_to(name, email), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name)')
      .in('area_id', areaIds)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getAllOpen(branchId?: string): Promise<ServiceIssue[]> {
    let query = supabase
      .from('service_issues')
      .select('*, reporter:profiles!reported_by(name, email, company), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
    const { data } = await query;
    return data ?? [];
  },

  async getCompleted(search?: string, limit: number = 50, branchId?: string): Promise<ServiceIssue[]> {
    let query = supabase
      .from('service_issues')
      .select('*, reporter:profiles!reported_by(name, email, company), assignee:profiles!assigned_to(name, email), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name)')
      .eq('status', 'completed')
      .order('resolved_at', { ascending: false })
      .limit(limit);
    if (search) {
      query = query.or(`description.ilike.%${search}%,resolution_note.ilike.%${search}%,location.ilike.%${search}%,device_name.ilike.%${search}%`);
    }
    if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
    const { data } = await query;
    return data ?? [];
  },

  async update(id: string, updates: Partial<ServiceIssue>): Promise<ServiceIssue> {
    const { reporter, assignee, area, product, ...dbUpdates } = updates as ServiceIssue;
    return throwOnError(
      await supabase
        .from('service_issues')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

// ============================================================================
// SERVICE ISSUE LOGS (added by Antigravity)
// ============================================================================

export const serviceIssueLogsDb = {
  async create(log: Omit<ServiceIssueLog, 'id' | 'created_at' | 'changer'>): Promise<ServiceIssueLog> {
    return throwOnError(
      await supabase.from('service_issue_logs').insert(log).select('*').single()
    );
  },

  async getByIssue(issueId: string): Promise<ServiceIssueLog[]> {
    const { data } = await supabase
      .from('service_issue_logs')
      .select('*, changer:profiles!changed_by(name, email)')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });
    return data ?? [];
  },
};

// ============================================================================
// PREVENTIVE MAINTENANCE (added by Antigravity)
// ============================================================================

export const equipmentAssetsDb = {
  async create(asset: Omit<EquipmentAsset, 'id' | 'created_at' | 'updated_at' | 'client' | 'area' | 'product'>): Promise<EquipmentAsset> {
    return throwOnError(
      await supabase.from('equipment_assets').insert(asset).select('*').single()
    );
  },

  async getById(id: string): Promise<EquipmentAsset | null> {
    const { data } = await supabase
      .from('equipment_assets')
      .select('*, client:profiles!client_id(name, email, company), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name, category, image_url)')
      .eq('id', id)
      .single();
    return data;
  },

  async getByClient(clientId: string): Promise<EquipmentAsset[]> {
    const { data } = await supabase
      .from('equipment_assets')
      .select('*, area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name, category, image_url)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getAll(): Promise<EquipmentAsset[]> {
    const { data } = await supabase
      .from('equipment_assets')
      .select('*, client:profiles!client_id(name, email, company), area:technician_areas!area_id(area_name, hospital_name), product:products!product_id(name, category, image_url)')
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async update(id: string, updates: Partial<EquipmentAsset>): Promise<EquipmentAsset> {
    const { client, area, product, ...dbUpdates } = updates as EquipmentAsset;
    return throwOnError(
      await supabase
        .from('equipment_assets')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

export const pmSchedulesDb = {
  async create(schedule: Omit<PmSchedule, 'id' | 'created_at' | 'updated_at' | 'asset' | 'technician'>): Promise<PmSchedule> {
    return throwOnError(
      await supabase.from('pm_schedules').insert(schedule).select('*').single()
    );
  },

  async getById(id: string): Promise<PmSchedule | null> {
    const { data } = await supabase
      .from('pm_schedules')
      .select('*, asset:equipment_assets!asset_id(serial_number, product_id, client_id, area_id, product:products!product_id(name, category), client:profiles!client_id(name, company), area:technician_areas!area_id(area_name, hospital_name)), technician:profiles!technician_id(name, email)')
      .eq('id', id)
      .single();
    return data;
  },

  async getByAsset(assetId: string): Promise<PmSchedule[]> {
    const { data } = await supabase
      .from('pm_schedules')
      .select('*, technician:profiles!technician_id(name, email)')
      .eq('asset_id', assetId)
      .order('due_date', { ascending: false });
    return data ?? [];
  },

  async getByClient(clientId: string): Promise<PmSchedule[]> {
    const { data } = await supabase
      .from('pm_schedules')
      .select('*, asset:equipment_assets!inner(client_id, serial_number, product:products(name)), technician:profiles!technician_id(name)')
      .eq('equipment_assets.client_id', clientId)
      .order('due_date', { ascending: true });
    return data ?? [];
  },

  async getUpcoming(technicianId?: string, areaIds?: string[]): Promise<PmSchedule[]> {
    let query = supabase
      .from('pm_schedules')
      .select('*, asset:equipment_assets!inner(serial_number, area_id, product:products(name), client:profiles(name, company), area:technician_areas(hospital_name)), technician:profiles!technician_id(name)')
      .neq('status', 'completed')
      .order('due_date', { ascending: true });

    if (technicianId) {
      // Get assigned to tech, or in areas tech covers, or unassigned general
      if (areaIds && areaIds.length > 0) {
        query = query.or(`technician_id.eq.${technicianId},technician_id.is.null,equipment_assets(area_id.in.(${areaIds.join(',')}))`);
      } else {
        query = query.or(`technician_id.eq.${technicianId},technician_id.is.null`);
      }
    }

    const { data } = await query;
    return data ?? [];
  },

  async update(id: string, updates: Partial<PmSchedule>): Promise<PmSchedule> {
    const { asset, technician, ...dbUpdates } = updates as PmSchedule;
    return throwOnError(
      await supabase
        .from('pm_schedules')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

// ============================================================================
// FAKTUR ROLE SYSTEM (added by Antigravity)
// ============================================================================

export const fakturTasksDb = {
  async create(task: Omit<FakturTask, 'id' | 'created_at' | 'updated_at' | 'client' | 'assignee' | 'creator'>): Promise<FakturTask> {
    return throwOnError(
      await supabase.from('faktur_tasks').insert(task).select('*').single()
    );
  },

  async getById(id: string): Promise<FakturTask | null> {
    const { data } = await supabase
      .from('faktur_tasks')
      .select('*, client:profiles!client_id(name, email, company, address, phone, pic_name), assignee:profiles!assigned_to(name, email), creator:profiles!created_by(name, email)')
      .eq('id', id)
      .single();
    return data;
  },

  async getUpcoming(assigneeId?: string): Promise<FakturTask[]> {
    let query = supabase
      .from('faktur_tasks')
      .select('*, client:profiles!client_id(name, email, company, address, phone, pic_name), creator:profiles!created_by(name, email)')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: true, nullsFirst: true });

    if (assigneeId) {
      query = query.or(`assigned_to.eq.${assigneeId},assigned_to.is.null`);
    }

    const { data } = await query;
    return data ?? [];
  },

  async getByClient(clientId: string): Promise<FakturTask[]> {
    const { data } = await supabase
      .from('faktur_tasks')
      .select('*, assignee:profiles!assigned_to(name, email), creator:profiles!created_by(name, email)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getAll(): Promise<FakturTask[]> {
    const { data } = await supabase
      .from('faktur_tasks')
      .select('*, client:profiles!client_id(name, email, company, address, phone, pic_name), assignee:profiles!assigned_to(name, email), creator:profiles!created_by(name, email)')
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async update(id: string, updates: Partial<FakturTask>): Promise<FakturTask> {
    const { client, assignee, creator, ...dbUpdates } = updates as FakturTask;
    return throwOnError(
      await supabase
        .from('faktur_tasks')
        .update({ ...dbUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
    );
  },
};

// ============================================================================
// ORION: BRANCHES
// ============================================================================

export const branchesDb = {
  async getAll(): Promise<Branch[]> {
    const { data } = await supabase
      .from('branches')
      .select('*, region:regions(*)')
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  },

  async getById(id: string): Promise<Branch | null> {
    const { data } = await supabase
      .from('branches')
      .select('*, region:regions(*)')
      .eq('id', id)
      .single();
    return data;
  },

  async getByRegion(regionId: string): Promise<Branch[]> {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('region_id', regionId)
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  },
};

export const regionsDb = {
  async getAll(): Promise<Region[]> {
    const { data } = await supabase
      .from('regions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  },
};

// ============================================================================
// ORION: DELIVERIES
// ============================================================================

export const deliveriesDb = {
  async getById(id: string): Promise<Delivery | null> {
    const { data } = await supabase
      .from('deliveries')
      .select('*, delivery_items(*, product:products(name, image_url, unit)), delivery_team(*, user:profiles(name, email, role)), delivery_proofs(*)')
      .eq('id', id)
      .single();
    return data;
  },

  async getByBranch(branchId: string, pagination?: PaginationParams): Promise<{ data: Delivery[]; count: number }> {
    let query = supabase
      .from('deliveries')
      .select('*, delivery_team(user_id)', { count: 'exact' })
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async getByStatus(status: DeliveryStatus | DeliveryStatus[]): Promise<Delivery[]> {
    const statuses = Array.isArray(status) ? status : [status];
    const { data } = await supabase
      .from('deliveries')
      .select('*, delivery_team(user_id)')
      .in('status', statuses)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async create(delivery: { request_id: string; branch_id: string; invoice_id?: string; notes?: string; scheduled_date?: string; created_by: string }): Promise<Delivery> {
    return throwOnError(
      await supabase.from('deliveries').insert(delivery).select('*').single()
    );
  },

  async update(id: string, updates: Partial<Delivery>): Promise<Delivery> {
    const { items, team, proofs, request, branch, ...dbUpdates } = updates as any;
    return throwOnError(
      await supabase.from('deliveries').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
    );
  },

  async addTeamMember(deliveryId: string, userId: string, teamRole: string): Promise<void> {
    const { error } = await supabase.from('delivery_team').insert({ delivery_id: deliveryId, user_id: userId, team_role: teamRole });
    if (error) throw new Error(error.message);
  },

  async addProof(proof: { delivery_id: string; proof_type: string; file_url: string; caption?: string; uploaded_by: string }): Promise<void> {
    const { error } = await supabase.from('delivery_proofs').insert(proof);
    if (error) throw new Error(error.message);
  },

  async addStatusLog(log: { delivery_id: string; from_status?: string; to_status: string; changed_by: string; note?: string; latitude?: number; longitude?: number }): Promise<void> {
    const { error } = await supabase.from('delivery_status_logs').insert(log);
    if (error) throw new Error(error.message);
  },
};

// ============================================================================
// ORION: APPROVALS
// ============================================================================

export const approvalsDb = {
  async getPending(branchId?: string): Promise<Approval[]> {
    let query = supabase
      .from('approvals')
      .select('*, requester:profiles!requested_by(name, email, role)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (branchId) query = query.eq('branch_id', branchId);
    const { data } = await query;
    return data ?? [];
  },

  async getAll(filters?: { status?: ApprovalStatus; type?: ApprovalType; branchId?: string }, pagination?: PaginationParams): Promise<{ data: Approval[]; count: number }> {
    let query = supabase
      .from('approvals')
      .select('*, requester:profiles!requested_by(name, email, role)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.type) query = query.eq('approval_type', filters.type);
    if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async create(approval: { approval_type: string; reference_id: string; reference_table: string; title: string; description?: string; amount?: number; branch_id?: string; requested_by: string }): Promise<Approval> {
    return throwOnError(
      await supabase.from('approvals').insert(approval).select('*').single()
    );
  },

  async approve(id: string, approvedBy: string): Promise<Approval> {
    return throwOnError(
      await supabase.from('approvals').update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
    );
  },

  async reject(id: string, approvedBy: string, reason: string): Promise<Approval> {
    return throwOnError(
      await supabase.from('approvals').update({ status: 'rejected', approved_by: approvedBy, approved_at: new Date().toISOString(), rejection_reason: reason, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
    );
  },
};

// ============================================================================
// ORION: PURCHASING
// ============================================================================

export const suppliersDb = {
  async getAll(): Promise<Supplier[]> {
    const { data } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name');
    return data ?? [];
  },

  async create(supplier: { name: string; contact?: string; email?: string; phone?: string; address?: string; notes?: string; created_by?: string }): Promise<Supplier> {
    return throwOnError(await supabase.from('suppliers').insert(supplier).select('*').single());
  },

  async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    return throwOnError(await supabase.from('suppliers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single());
  },
};

export const purchaseRequestsDb = {
  async getAll(branchId?: string, status?: PurchaseRequestStatus): Promise<PurchaseRequest[]> {
    let query = supabase.from('purchase_requests').select('*, items:purchase_request_items(*), requester:profiles!requested_by(name, email)').order('created_at', { ascending: false });
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    return data ?? [];
  },

  async create(pr: { branch_id: string; requested_by: string; title: string; notes?: string; total_estimated: number }): Promise<PurchaseRequest> {
    return throwOnError(await supabase.from('purchase_requests').insert(pr).select('*').single());
  },

  async update(id: string, updates: Partial<PurchaseRequest>): Promise<PurchaseRequest> {
    const { items, branch, requester, ...dbUpdates } = updates as any;
    return throwOnError(await supabase.from('purchase_requests').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single());
  },
};

export const purchaseOrdersDb = {
  async getAll(branchId?: string, status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
    let query = supabase.from('purchase_orders').select('*, items:purchase_order_items(*), supplier:suppliers(*)').order('created_at', { ascending: false });
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    return data ?? [];
  },

  async create(po: { purchase_request_id?: string; branch_id: string; supplier_id: string; po_number: string; total: number; tax_amount?: number; notes?: string; created_by: string }): Promise<PurchaseOrder> {
    return throwOnError(await supabase.from('purchase_orders').insert(po).select('*').single());
  },

  async update(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const { items, supplier, branch, ...dbUpdates } = updates as any;
    return throwOnError(await supabase.from('purchase_orders').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single());
  },
};

// ============================================================================
// ORION: EXPENSE CLAIMS & CASH ADVANCES
// ============================================================================

export const expenseClaimsDb = {
  async getAll(branchId?: string, status?: ExpenseClaimStatus): Promise<ExpenseClaim[]> {
    let query = supabase.from('expense_claims').select('*, claimant:profiles!claimant_id(name, email, role)').order('created_at', { ascending: false });
    if (branchId) query = query.eq('branch_id', branchId);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    return data ?? [];
  },

  async create(claim: { branch_id: string; claimant_id: string; category: string; title: string; description?: string; amount: number; receipt_url?: string }): Promise<ExpenseClaim> {
    return throwOnError(await supabase.from('expense_claims').insert(claim).select('*').single());
  },

  async update(id: string, updates: Partial<ExpenseClaim>): Promise<ExpenseClaim> {
    const { claimant, branch, ...dbUpdates } = updates as any;
    return throwOnError(await supabase.from('expense_claims').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single());
  },
};

export const claimLedgerDb = {
  async getByUser(userId: string): Promise<ClaimLedger[]> {
    const { data } = await supabase.from('claim_ledger').select('*').eq('user_id', userId).order('year', { ascending: false }).order('month', { ascending: false });
    return data ?? [];
  },

  async getCurrent(userId: string): Promise<ClaimLedger | null> {
    const now = new Date();
    const { data } = await supabase.from('claim_ledger').select('*').eq('user_id', userId).eq('month', now.getMonth() + 1).eq('year', now.getFullYear()).single();
    return data;
  },
};

export const cashAdvancesDb = {
  async getByUser(userId: string): Promise<CashAdvance[]> {
    const { data } = await supabase.from('cash_advances').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async create(ca: { branch_id: string; user_id: string; amount: number; purpose: string }): Promise<CashAdvance> {
    return throwOnError(await supabase.from('cash_advances').insert(ca).select('*').single());
  },

  async update(id: string, updates: Partial<CashAdvance>): Promise<CashAdvance> {
    const { user, branch, ...dbUpdates } = updates as any;
    return throwOnError(await supabase.from('cash_advances').update({ ...dbUpdates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single());
  },
};

// ============================================================================
// ORION: FINANCIAL TRANSACTIONS
// ============================================================================

export const financialTransactionsDb = {
  async getAll(branchId?: string, pagination?: PaginationParams): Promise<{ data: FinancialTransaction[]; count: number }> {
    let query = supabase.from('financial_transactions').select('*, recorder:profiles!recorded_by(name, email)', { count: 'exact' }).order('created_at', { ascending: false });
    if (branchId) query = query.eq('branch_id', branchId);
    if (pagination) query = paginate(query, pagination) as typeof query;
    const result = await query;
    return { data: result.data ?? [], count: result.count ?? 0 };
  },

  async create(tx: { branch_id: string; transaction_type: string; direction: string; amount: number; reference_id?: string; reference_table?: string; description: string; payment_method?: string; payment_ref?: string; recorded_by: string }): Promise<FinancialTransaction> {
    return throwOnError(await supabase.from('financial_transactions').insert(tx).select('*').single());
  },

  async getSummary(branchId: string, month: number, year: number): Promise<{ total_inflow: number; total_outflow: number; net: number }> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    const { data } = await supabase.from('financial_transactions').select('direction, amount').eq('branch_id', branchId).gte('created_at', startDate).lte('created_at', endDate);
    const rows = data ?? [];
    const total_inflow = rows.filter(r => r.direction === 'inflow').reduce((s, r) => s + Number(r.amount), 0);
    const total_outflow = rows.filter(r => r.direction === 'outflow').reduce((s, r) => s + Number(r.amount), 0);
    return { total_inflow, total_outflow, net: total_inflow - total_outflow };
  },
};

// ============================================================================
// ORION: PRODUCT BRANCH STOCK
// ============================================================================

export const productBranchStockDb = {
  async getByBranch(branchId: string): Promise<ProductBranchStock[]> {
    const { data } = await supabase.from('product_branch_stock').select('*, product:products(name, sku, category, image_url, unit)').eq('branch_id', branchId).eq('is_active', true);
    return data ?? [];
  },

  async getLowStock(branchId: string): Promise<ProductBranchStock[]> {
    const { data } = await supabase.from('product_branch_stock').select('*, product:products(name, sku, category)').eq('branch_id', branchId).eq('is_active', true).filter('stock', 'lte', 'min_stock');
    return data ?? [];
  },

  async upsert(stock: { product_id: string; branch_id: string; stock: number; min_stock?: number }): Promise<ProductBranchStock> {
    return throwOnError(
      await supabase.from('product_branch_stock').upsert(stock, { onConflict: 'product_id,branch_id' }).select('*').single()
    );
  },
};

// ============================================================================
// ORION: NEW TABLES FROM GAPS
// ============================================================================

export const stockTransferLogsDb = {
  async getByTransfer(transferId: string): Promise<StockTransferLog[]> {
    const { data } = await supabase.from('stock_transfer_logs').select('*, user:profiles(name, email, role)').eq('transfer_id', transferId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async create(log: Omit<StockTransferLog, 'id' | 'created_at' | 'user'>): Promise<StockTransferLog> {
    const { data } = await supabase.from('stock_transfer_logs').insert(log).select('*').single();
    if (!data) throw new Error('Failed to create stock transfer log');
    return data;
  },
};

export const claimPaymentsDb = {
  async getByClaim(claimId: string): Promise<ClaimPayment[]> {
    const { data } = await supabase.from('claim_payments').select('*, payer:profiles(name)').eq('claim_id', claimId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async create(payment: Omit<ClaimPayment, 'id' | 'created_at' | 'payer'>): Promise<ClaimPayment> {
    const { data } = await supabase.from('claim_payments').insert(payment).select('*').single();
    if (!data) throw new Error('Failed to create claim payment');
    return data;
  },
};

export const supplierInvoicesDb = {
  async getBySupplier(supplierId: string): Promise<SupplierInvoice[]> {
    const { data } = await supabase.from('supplier_invoices').select('*, branch:branches(name), supplier:suppliers(name)').eq('supplier_id', supplierId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async getByPo(poId: string): Promise<SupplierInvoice[]> {
    const { data } = await supabase.from('supplier_invoices').select('*').eq('purchase_order_id', poId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async getByBranch(branchId: string): Promise<SupplierInvoice[]> {
    const { data } = await supabase.from('supplier_invoices').select('*, supplier:suppliers(name)').eq('branch_id', branchId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async create(invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at' | 'supplier' | 'branch'>): Promise<SupplierInvoice> {
    const { data } = await supabase.from('supplier_invoices').insert(invoice).select('*').single();
    if (!data) throw new Error('Failed to create supplier invoice');
    return data;
  },

  async update(id: string, updates: Partial<SupplierInvoice>): Promise<SupplierInvoice> {
    const { data } = await supabase.from('supplier_invoices').update(updates).eq('id', id).select('*').single();
    if (!data) throw new Error('Failed to update supplier invoice');
    return data;
  },
};

// ============================================================================
// REQUEST NOTES (targeted role-to-role private notes)
// ============================================================================

export const requestNotesDb = {
  async getByRequest(requestId: string): Promise<RequestNote[]> {
    const { data } = await supabase
      .from('request_notes')
      .select('*, sender:profiles!from_user_id(name, email, role)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    return data ?? [];
  },

  async create(note: {
    request_id: string;
    from_user_id: string;
    from_role: string;
    to_role: string;
    message: string;
  }): Promise<RequestNote> {
    const { data } = await supabase
      .from('request_notes')
      .insert(note)
      .select('*, sender:profiles!from_user_id(name, email, role)')
      .single();
    if (!data) throw new Error('Failed to create note');
    return data;
  },
};

// ============================================================================
// REQUEST STATUS LOGS
// ============================================================================

export const requestStatusLogsDb = {
  async create(log: { request_id: string; status: RequestStatus; actor_id: string }): Promise<RequestStatusLog> {
    const { data } = await supabase
      .from('request_status_logs')
      .insert(log)
      .select('*')
      .single();
    if (!data) throw new Error('Failed to create status log');
    return data;
  },

  async getByRequestId(requestId: string): Promise<RequestStatusLog[]> {
    const { data } = await supabase
      .from('request_status_logs')
      .select('*, actor:profiles(id, name, email, avatar_url, role, bio, created_at, quotes, avg_rating, joined_date)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    return (data ?? []) as RequestStatusLog[];
  },
};

// ============================================================================
// STAFF RATINGS
// ============================================================================

export const staffRatingsDb = {
  async upsert(rating: { request_id: string; status: RequestStatus; staff_id: string; client_id: string; rating: number }): Promise<StaffRating> {
    const { data } = await supabase
      .from('staff_ratings')
      .upsert(rating, { onConflict: 'request_id,status,client_id' })
      .select('*')
      .single();
    if (!data) throw new Error('Failed to save rating');
    return data;
  },

  async getByRequestId(requestId: string): Promise<StaffRating[]> {
    const { data } = await supabase
      .from('staff_ratings')
      .select('*')
      .eq('request_id', requestId);
    return data ?? [];
  },

  async getAverageByStaffId(staffId: string): Promise<number> {
    const { data } = await supabase
      .from('staff_ratings')
      .select('rating')
      .eq('staff_id', staffId);
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / data.length) * 100) / 100;
  },
};
