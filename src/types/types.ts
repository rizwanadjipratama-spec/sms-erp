// ============================================================================
// WEBSMS ERP SYSTEM — TYPE DEFINITIONS
// All types match the database schema exactly
// ============================================================================

// ============================================================================
// ENUMS (match PostgreSQL enums)
// ============================================================================

export type UserRole =
  | 'client'
  | 'marketing'
  | 'boss'
  | 'finance'
  | 'warehouse'
  | 'technician'
  | 'admin'
  | 'owner'
  | 'tax';

export type ClientType = 'regular' | 'kso' | 'cost_per_test';

export type RequestStatus =
  | 'submitted'
  | 'priced'
  | 'approved'
  | 'invoice_ready'
  | 'preparing'
  | 'ready'
  | 'on_delivery'
  | 'delivered'
  | 'completed'
  | 'issue'
  | 'resolved'
  | 'cancelled'
  | 'rejected';

export type RequestPriority = 'normal' | 'cito';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'credited';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export type LogLevel = 'info' | 'warning' | 'error';

export type ChatChannelType =
  | 'general'
  | 'marketing'
  | 'finance'
  | 'warehouse'
  | 'technician'
  | 'admin'
  | 'owner'
  | 'tax';

export type ProductCategory =
  | 'Equipment'
  | 'Consumables'
  | 'Service & Support'
  | 'Reagents'
  | 'Service';

export type BackupType = 'database' | 'storage' | 'full';
export type BackupStatus = 'pending' | 'completed' | 'failed' | 'verified' | 'restored' | 'partial';
export type AutomationStatus = 'pending' | 'processed' | 'failed';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  phone?: string;
  address?: string;
  client_type?: ClientType;
  pic_name?: string;
  company?: string;
  avatar_url?: string;
  handled_by?: string;
  debt_amount: number;
  debt_limit: number;
  two_factor_secret?: string | null;
  two_factor_enabled: boolean;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined fields (not in DB)
  handler?: { name?: string; email: string };
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  category?: ProductCategory;
  image_url?: string;
  stock: number;
  min_stock: number;
  unit: string;
  is_active: boolean;
  is_priced: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined fields
  price?: PriceList;
}

export interface PriceList {
  id: string;
  product_id: string;
  price_regular: number;
  price_kso: number;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface DbRequest {
  id: string;
  user_id: string;
  user_email?: string;
  status: RequestStatus;
  priority: RequestPriority;
  total_price: number;
  note?: string;
  invoice_id?: string;
  assigned_technician_id?: string;
  rejection_reason?: string;
  priced_at?: string;
  approved_at?: string;
  rejected_at?: string;
  invoice_ready_at?: string;
  preparing_at?: string;
  ready_at?: string;
  on_delivery_at?: string;
  delivered_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined
  request_items?: RequestItemWithProduct[];
  profiles?: Pick<Profile, 'name' | 'email'>;
}

export interface RequestItem {
  id: string;
  request_id: string;
  product_id: string;
  quantity: number;
  price_at_order: number;
  created_at: string;
  updated_at: string;
}

export interface RequestItemWithProduct extends RequestItem {
  products?: Pick<Product, 'name' | 'image_url' | 'unit'>;
}

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  issued_at?: string;
  due_date?: string;
  paid_at?: string;
  payment_method?: string;
  payment_ref?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined
  request?: Pick<DbRequest, 'id' | 'user_id' | 'user_email' | 'status'>;
}

export interface PaymentPromise {
  id: string;
  user_id: string;
  user_email?: string;
  request_id?: string;
  promise_date: string;
  note?: string;
  fulfilled: boolean;
  fulfilled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryLog {
  id: string;
  order_id: string;
  technician_id: string;
  status: string;
  note?: string;
  proof_url?: string;
  signature_url?: string;
  delivered_at?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
  // Joined
  technician?: Pick<Profile, 'name' | 'email'>;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  order_id?: string;
  change: number;
  balance: number;
  reason: string;
  created_by?: string;
  created_at: string;
  // Joined
  product?: Pick<Product, 'name'>;
}

export interface Issue {
  id: string;
  order_id: string;
  reported_by: string;
  assigned_to?: string;
  description: string;
  status: IssueStatus;
  resolution?: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyClosing {
  id: string;
  month: number;
  year: number;
  total_revenue: number;
  total_tax: number;
  orders_count: number;
  paid_invoices: number;
  unpaid_invoices: number;
  closed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

export interface Notification {
  id: string;
  user_id: string;
  title?: string;
  message: string;
  type: NotificationType;
  read: boolean;
  read_at?: string;
  order_id?: string;
  action_url?: string;
  created_at: string;
}

// ============================================================================
// CHAT SYSTEM
// ============================================================================

export interface ChatChannel {
  id: string;
  name: string;
  channel_type: ChatChannelType;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  is_edited: boolean;
  is_deleted: boolean;
  reply_to?: string;
  created_at: string;
  updated_at: string;
  // Joined
  sender?: Pick<Profile, 'name' | 'email' | 'avatar_url' | 'role'>;
}

// ============================================================================
// CMS SYSTEM
// ============================================================================

export interface CmsSection {
  id: string;
  section_key: string;
  title?: string;
  subtitle?: string;
  body?: string;
  image_url?: string;
  video_url?: string;
  cta_text?: string;
  cta_link?: string;
  sort_order: number;
  is_visible: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface CmsMedia {
  id: string;
  section_id?: string;
  title?: string;
  alt_text?: string;
  file_url: string;
  file_type: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by?: string;
}

export interface CmsPartner {
  id: string;
  name: string;
  logo_url: string;
  website_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsSolution {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: ProductCategory;
  image_url?: string;
  specs: string[];
  use_case?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeOfMonth {
  id: string;
  user_id: string;
  month: number;
  year: number;
  reason?: string;
  photo_url?: string;
  created_at: string;
  created_by?: string;
  // Joined
  profile?: Pick<Profile, 'name' | 'email' | 'role'>;
}

// ============================================================================
// LOGGING & SYSTEM
// ============================================================================

export interface ActivityLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface SystemLog {
  id: string;
  level: LogLevel;
  service: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface BackupLog {
  id: string;
  backup_type: BackupType;
  file_url?: string | null;
  status: BackupStatus;
  size?: number | null;
  notes?: string | null;
  created_at: string;
  completed_at?: string | null;
}

// ============================================================================
// AUTOMATION
// ============================================================================

export interface AutomationEvent {
  id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  status: AutomationStatus;
  retry_count: number;
  last_error?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface AutomationWebhook {
  id: string;
  event_type: string;
  webhook_url: string;
  active: boolean;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  event_id?: string;
  webhook_url?: string;
  status: string;
  response?: string | null;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  variables?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// APPLICATION-LEVEL TYPES
// ============================================================================

export interface CartItem {
  id: string;
  name?: string;
  qty: number;
  price?: number;
  image_url?: string;
}

export interface Actor {
  id: string;
  email?: string;
  role: UserRole;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// Analytics types
export interface MonthlyRevenue {
  month: string;
  invoice_count: number;
  total_revenue: number;
  total_tax: number;
  paid_count: number;
  unpaid_count: number;
}

export interface OrderPipeline {
  status: RequestStatus;
  order_count: number;
  total_value: number;
  avg_hours_in_status: number;
}

export interface ProductPerformance {
  id: string;
  name: string;
  category?: ProductCategory;
  stock: number;
  total_ordered: number;
  total_revenue: number;
  order_count: number;
}

export interface TechnicianPerformance {
  technician_id: string;
  technician_name?: string;
  total_deliveries: number;
  successful_deliveries: number;
  avg_delivery_hours: number;
}
