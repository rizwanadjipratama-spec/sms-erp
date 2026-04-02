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
  | 'courier'
  | 'faktur'
  | 'admin'
  | 'owner'
  | 'director'
  | 'tax'
  | 'manager'
  | 'purchasing'
  | 'claim_officer';

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
  | 'courier'
  | 'admin'
  | 'owner'
  | 'tax';

export type ProductCategory =
  | 'Equipment'
  | 'Consumables'
  | 'Service & Support'
  | 'Reagents'
  | 'Service';

export type DiscountType = 'percent' | 'fixed';

export type DeliverySubStatus = 'otw' | 'arrived' | 'delivering' | 'completed';

export type BackupType = 'database' | 'storage' | 'full';
export type BackupStatus = 'pending' | 'completed' | 'failed' | 'verified' | 'restored' | 'partial';
export type AutomationStatus = 'pending' | 'processed' | 'failed';

export type ServiceIssueStatus = 'open' | 'otw' | 'arrived' | 'working' | 'completed';
export type AreaTransferStatus = 'pending' | 'accepted' | 'rejected';

// ORION Business System Enums
export type StockTransferStatus = 
  | 'draft' 
  | 'requested' 
  | 'approved' 
  | 'preparing' 
  | 'shipped' 
  | 'in_transit' 
  | 'arrived' 
  | 'received' 
  | 'completed' 
  | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalType = 'expense_claim' | 'purchase_request' | 'cash_advance' | 'discount' | 'stock_transfer' | 'branch_override' | 'maintenance_cost' | 'large_purchase';
export type PurchaseRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'ordered' | 'partial_received' | 'received' | 'cancelled';
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partial_received' | 'received' | 'cancelled';
export type ExpenseClaimStatus = 'draft' | 'submitted' | 'approved' | 'paid' | 'partial_paid' | 'rejected' | 'cancelled';
export type ExpenseCategory = 'fuel' | 'toll' | 'parking' | 'small_tools' | 'sparepart' | 'hotel' | 'meals' | 'vehicle_service' | 'operational' | 'other';
export type CashAdvanceStatus = 'requested' | 'approved' | 'disbursed' | 'settled' | 'rejected' | 'cancelled';
export type FinancialTransactionType = 'invoice_payment' | 'supplier_payment' | 'expense_claim_payment' | 'cash_advance_disbursement' | 'cash_advance_settlement' | 'refund' | 'adjustment' | 'other';
export type FinancialDirection = 'inflow' | 'outflow';

// ORION Delivery & Issue Enums
export type DeliveryStatus = 'created' | 'assigned' | 'picking' | 'picked' | 'on_delivery' | 'delivered' | 'confirmed' | 'cancelled';
export type DeliveryTeamRole = 'driver' | 'courier' | 'technician' | 'marketing' | 'finance' | 'faktur' | 'warehouse' | 'purchasing' | 'claim_officer' | 'other';
export type DeliveryProofType = 'photo' | 'signature' | 'document' | 'other';
export type IssueTechRole = 'primary' | 'supporting';
export type EnhancedIssueStatus = 'reported' | 'assigned' | 'open' | 'otw' | 'arrived' | 'working' | 'waiting_parts' | 'testing' | 'completed' | 'cancelled';
export type IssuePriority = 'normal' | 'high' | 'critical';
export type InventoryMovementType = 'PURCHASE_IN' | 'SALES_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'STOCK_OPNAME' | 'RETURN' | 'SERVICE_PART';

// ============================================================================
// REGION & BRANCH
// ============================================================================

export interface Region {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  region_id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  region?: Region;
  // Geofencing
  latitude?: number;
  longitude?: number;
  geofence_radius?: number;
}

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
  bio?: string;
  city?: string;
  province?: string;
  client_type?: ClientType;
  pic_name?: string;
  company?: string;
  avatar_url?: string;
  handled_by?: string;
  branch_id?: string | null;
  is_branch_pinned?: boolean | null;
  profile_completed: boolean;
  leave_balance: number;
  debt_amount: number;
  debt_limit: number;
  two_factor_secret?: string | null;
  two_factor_enabled: boolean;
  is_active: boolean;
  last_login?: string;
  last_active_at?: string;
  quotes?: string[];
  avg_rating?: number;
  joined_date?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined fields (not in DB)
  handler?: { name?: string; email: string };
  branch?: Branch;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: 'annual' | 'sick' | 'maternity' | 'marriage' | 'unpaid';
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  attachment_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joins
  profiles?: Pick<Profile, 'name' | 'email' | 'avatar_url' | 'role'>;
  reviewer?: Pick<Profile, 'name' | 'email'>;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  branch_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  clock_in_lat?: number;
  clock_in_lng?: number;
  clock_out_lat?: number;
  clock_out_lng?: number;
  is_late: boolean;
  is_early_leave: boolean;
  is_overtime: boolean;
  early_leave_reason?: string;
  overtime_reason?: string;
  proof_url?: string;
  is_manual: boolean;
  manual_note?: string;
  created_at: string;
  updated_at: string;
  // Joins
  profiles?: Pick<Profile, 'id' | 'name' | 'email' | 'avatar_url' | 'role'>;
  branches?: Pick<Branch, 'id' | 'name' | 'code'>;
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
  branch_id?: string;
  is_active: boolean;
  is_priced: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined fields
  price?: PriceList;
  branch?: Branch;
}

export interface PriceList {
  id: string;
  product_id: string;
  price_regular: number;
  price_kso: number;
  price_cost_per_test: number;
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
  assigned_courier_id?: string;
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
  // Discount fields
  discount_type?: DiscountType;
  discount_value?: number;
  discount_amount?: number;
  discount_reason?: string;
  discounted_by?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Joined
  request_items?: RequestItemWithProduct[];
  profiles?: Pick<Profile, 'name' | 'email'>;
  branch?: Pick<Branch, 'name' | 'code'>;
}

export interface RequestItem {
  id: string;
  request_id: string;
  product_id: string;
  quantity: number;
  price_at_order: number;
  discount_percentage?: number;
  created_at: string;
  updated_at: string;
}

export interface RequestItemWithProduct extends RequestItem {
  products?: Pick<Product, 'name' | 'image_url' | 'unit'>;
}

export interface Invoice {
  id: string;
  order_id: string;
  branch_id?: string;
  invoice_number: string;
  subtotal: number;
  discount_amount?: number;
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
  technician_id?: string;
  courier_id?: string;
  status: string;
  accompanying_staff?: string;
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
  courier?: Pick<Profile, 'name' | 'email'>;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  order_id?: string;
  change: number;
  balance: number;
  movement_type: InventoryMovementType;
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

// ── Technician Area & Issue System (added by Antigravity) ───────────────

export interface TechnicianArea {
  id: string;
  technician_id: string;
  area_name: string;
  hospital_name: string;
  address?: string;
  phone?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  technician?: Pick<Profile, 'name' | 'email'>;
}

export interface AreaTransferRequest {
  id: string;
  area_id: string;
  from_technician_id: string;
  to_technician_id: string;
  status: AreaTransferStatus;
  note?: string;
  response_note?: string;
  created_at: string;
  updated_at: string;
  // Joined
  area?: Pick<TechnicianArea, 'area_name' | 'hospital_name'>;
  from_technician?: Pick<Profile, 'name' | 'email'>;
  to_technician?: Pick<Profile, 'name' | 'email'>;
}

export interface ServiceIssue {
  id: string;
  reported_by: string;
  area_id?: string;
  assigned_to?: string;
  location: string;
  device_name?: string;
  product_id?: string;
  description: string;
  notes?: string;
  photo_urls: string[];
  status: ServiceIssueStatus;
  resolution_note?: string;
  resolved_at?: string;
  taken_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  reporter?: Pick<Profile, 'name' | 'email' | 'company'>;
  assignee?: Pick<Profile, 'name' | 'email'>;
  area?: Pick<TechnicianArea, 'area_name' | 'hospital_name'>;
  product?: Pick<Product, 'name'>;
}

export interface ServiceIssueLog {
  id: string;
  issue_id: string;
  from_status?: string;
  to_status: string;
  changed_by: string;
  note?: string;
  created_at: string;
  // Joined
  changer?: Pick<Profile, 'name' | 'email'>;
}

// ── Preventive Maintenance System (added by Antigravity) ────────────────

export type PmStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'missed';

export interface EquipmentAsset {
  id: string;
  client_id: string;
  area_id?: string;
  product_id: string;
  serial_number: string;
  installation_date?: string;
  pm_frequency_months: number;
  status: 'active' | 'inactive' | 'maintenance' | 'retired';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Pick<Profile, 'name' | 'email' | 'company'>;
  area?: Pick<TechnicianArea, 'area_name' | 'hospital_name'>;
  product?: Pick<Product, 'name' | 'category' | 'image_url'>;
}

export interface PmSchedule {
  id: string;
  asset_id: string;
  technician_id?: string;
  due_date: string;
  status: PmStatus;
  completed_at?: string;
  notes?: string;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
  // Joined
  asset?: Pick<EquipmentAsset, 'serial_number' | 'product_id' | 'client_id' | 'area_id'> & {
    product?: Pick<Product, 'name' | 'category'>;
    client?: Pick<Profile, 'name' | 'company'>;
    area?: Pick<TechnicianArea, 'area_name' | 'hospital_name'>;
  };
  technician?: Pick<Profile, 'name' | 'email'>;
}

// ── Faktur Role System (added by Antigravity) ───────────────────────────

export type FakturTaskType = 'ttd_faktur' | 'tukar_faktur' | 'others';
export type FakturTaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface FakturTask {
  id: string;
  client_id: string;
  assigned_to?: string;
  created_by: string;
  task_type: FakturTaskType;
  status: FakturTaskStatus;
  scheduled_date?: string;
  notes?: string;
  completion_note?: string;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Pick<Profile, 'name' | 'email' | 'company' | 'address' | 'phone' | 'pic_name'>;
  assignee?: Pick<Profile, 'name' | 'email'>;
  creator?: Pick<Profile, 'name' | 'email'>;
}

export interface MonthlyClosing {
  id: string;
  branch_id?: string;
  month: string;
  year?: number;
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
// CMS SYSTEM
// ============================================================================

export interface CmsSettings {
  id: number;
  hero_title?: string;
  hero_subtitle?: string;
  hero_image_url?: string;
  hero_video_url?: string;
  about_heading?: string;
  about_text?: string;
  about_image_url?: string;
  announcement_text?: string;
  announcement_link?: string;
  announcement_is_active: boolean;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  employee_of_month_id?: string;
  updated_at: string;
  // Joined
  employee_of_month?: Pick<Profile, 'name' | 'email' | 'role' | 'avatar_url' | 'quotes' | 'avg_rating'>;
}

export interface CmsNews {
  id: string;
  title: string;
  slug: string;
  content: string;
  image_url?: string;
  is_published: boolean;
  published_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined
  creator?: Pick<Profile, 'name' | 'email'>;
}

export interface CmsEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_url?: string;
  event_date: string;
  location?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined
  creator?: Pick<Profile, 'name' | 'email'>;
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

// ============================================================================
// ORION BUSINESS ENTITIES
// ============================================================================

export interface ProductBranchStock {
  id: string;
  product_id: string;
  branch_id: string;
  stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  product?: Product;
  branch?: Branch;
}

export interface StockTransfer {
  id: string;
  from_branch_id: string;
  to_branch_id: string;
  status: StockTransferStatus;
  notes?: string;
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  received_by?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: StockTransferItem[];
  from_branch?: Branch;
  to_branch?: Branch;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  created_at: string;
  product?: Product;
}

export interface BranchPriceOverride {
  id: string;
  product_id: string;
  branch_id: string;
  price_regular?: number;
  price_kso?: number;
  price_cost_per_test?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  approval_type: ApprovalType;
  reference_id: string;
  reference_table: string;
  title: string;
  description?: string;
  amount?: number;
  branch_id?: string;
  requested_by: string;
  status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  requester?: Pick<Profile, 'name' | 'email' | 'role'>;
  approver?: Pick<Profile, 'name' | 'email'>;
  branch?: Branch;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PurchaseRequest {
  id: string;
  branch_id: string;
  requested_by: string;
  status: PurchaseRequestStatus;
  title: string;
  notes?: string;
  total_estimated: number;
  approval_id?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  // Joined
  items?: PurchaseRequestItem[];
  branch?: Branch;
  requester?: Pick<Profile, 'name' | 'email'>;
}

export interface PurchaseRequestItem {
  id: string;
  purchase_request_id: string;
  product_id?: string;
  item_name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  notes?: string;
  created_at: string;
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  purchase_request_id?: string;
  branch_id: string;
  supplier_id: string;
  po_number: string;
  status: PurchaseOrderStatus;
  total: number;
  tax_amount: number;
  notes?: string;
  ordered_at?: string;
  received_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: PurchaseOrderItem[];
  supplier?: Supplier;
  branch?: Branch;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id?: string;
  item_name: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: Product;
}

export interface ExpenseClaim {
  id: string;
  branch_id: string;
  claimant_id: string;
  status: ExpenseClaimStatus;
  category: ExpenseCategory;
  title: string;
  description?: string;
  amount: number;
  receipt_url?: string;
  approval_id?: string;
  approved_by?: string;
  approved_at?: string;
  paid_amount: number;
  paid_at?: string;
  paid_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined
  claimant?: Pick<Profile, 'name' | 'email' | 'role'>;
  branch?: Branch;
}

export interface ClaimLedger {
  id: string;
  user_id: string;
  branch_id: string;
  month: number;
  year: number;
  total_claimed: number;
  total_paid: number;
  remaining: number;
  is_closed: boolean;
  closed_at?: string;
  closed_by?: string;
  created_at: string;
  updated_at: string;
  // Joined
  user?: Pick<Profile, 'name' | 'email'>;
}

export interface CashAdvance {
  id: string;
  branch_id: string;
  user_id: string;
  status: CashAdvanceStatus;
  amount: number;
  purpose: string;
  approval_id?: string;
  approved_by?: string;
  approved_at?: string;
  disbursed_at?: string;
  settled_at?: string;
  settled_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  user?: Pick<Profile, 'name' | 'email' | 'role'>;
  branch?: Branch;
}

export interface FinancialTransaction {
  id: string;
  branch_id: string;
  transaction_type: FinancialTransactionType;
  direction: FinancialDirection;
  amount: number;
  reference_id?: string;
  reference_table?: string;
  description: string;
  payment_method?: string;
  payment_ref?: string;
  recorded_by: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  recorder?: Pick<Profile, 'name' | 'email'>;
  branch?: Branch;
}

// ============================================================================
// ORION DELIVERY & ISSUE ENTITIES
// ============================================================================

export interface Delivery {
  id: string;
  request_id: string;
  invoice_id?: string;
  branch_id: string;
  status: DeliveryStatus;
  notes?: string;
  scheduled_date?: string;
  delivered_at?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  request?: DbRequest;
  branch?: Branch;
  items?: DeliveryItem[];
  team?: DeliveryTeamMember[];
  proofs?: DeliveryProof[];
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity: number;
  notes?: string;
  created_at: string;
  product?: Product;
}

export interface DeliveryTeamMember {
  id: string;
  delivery_id: string;
  user_id: string;
  team_role: DeliveryTeamRole;
  notes?: string;
  created_at: string;
  user?: Pick<Profile, 'name' | 'email' | 'role'>;
}

export interface DeliveryProof {
  id: string;
  delivery_id: string;
  proof_type: DeliveryProofType;
  file_url: string;
  caption?: string;
  uploaded_by: string;
  created_at: string;
}

export interface DeliveryStatusLog {
  id: string;
  delivery_id: string;
  from_status?: DeliveryStatus;
  to_status: DeliveryStatus;
  changed_by: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export interface IssueTechnician {
  id: string;
  issue_id: string;
  technician_id: string;
  tech_role: IssueTechRole;
  joined_at: string;
  notes?: string;
  technician?: Pick<Profile, 'name' | 'email'>;
}

export interface IssueKnowledgeBase {
  id: string;
  issue_id?: string;
  title: string;
  device_name?: string;
  problem: string;
  solution: string;
  tags: string[];
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StockTransferLog {
  id: string;
  transfer_id: string;
  status: StockTransferStatus;
  changed_by: string;
  notes?: string;
  created_at: string;
  user?: Partial<Profile>;
}

export interface ClaimPayment {
  id: string;
  claim_id: string;
  amount: number;
  paid_by: string;
  payment_method?: string;
  payment_ref?: string;
  notes?: string;
  created_at: string;
  payer?: Partial<Profile>;
}

export type SupplierInvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled';

export interface SupplierInvoice {
  id: string;
  purchase_order_id: string;
  supplier_id: string;
  branch_id: string;
  invoice_number: string;
  total_amount: number;
  tax_amount: number;
  status: SupplierInvoiceStatus;
  due_date?: string;
  paid_amount: number;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  supplier?: Partial<Supplier>;
  branch?: Partial<Branch>;
}

// ============================================================================
// REQUEST NOTES (Targeted role-to-role private notes)
// ============================================================================

export interface RequestNote {
  id: string;
  request_id: string;
  from_user_id: string;
  from_role: string;
  to_role: string;
  message: string;
  created_at: string;
  sender?: Partial<Profile>;
}

// ============================================================================
// REQUEST STATUS LOGS (who handled each step)
// ============================================================================

export interface RequestStatusLog {
  id: string;
  request_id: string;
  status: RequestStatus;
  actor_id: string;
  created_at: string;
  // Joined
  actor?: Pick<Profile, 'id' | 'name' | 'email' | 'avatar_url' | 'role' | 'bio' | 'created_at' | 'quotes' | 'avg_rating' | 'joined_date'>;
}

// ============================================================================
// STAFF RATINGS (client rates handler per step)
// ============================================================================

export interface StaffRating {
  id: string;
  request_id: string;
  status: RequestStatus;
  staff_id: string;
  client_id: string;
  rating: number;
  created_at: string;
}
