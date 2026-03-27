export type Category =
  | 'Equipment'
  | 'Consumables'
  | 'Service & Support'
  | 'Reagents'
  | 'Service';

// All 9 system roles (+ legacy 'user' for backward compat)
export type UserRole =
  | 'client'
  | 'marketing'
  | 'boss'
  | 'finance'
  | 'warehouse'
  | 'technician'
  | 'admin'
  | 'owner'
  | 'tax'
  | 'user'; // legacy fallback

export type ClientType = 'regular' | 'kso';

export interface Profile {
  id?: string;
  email: string;
  role: UserRole;
  name?: string;
  phone?: string;
  address?: string;
  client_type?: ClientType;
  pic_name?: string;
  debt_amount: number;
  debt_limit: number;
  two_factor_secret?: string | null;
  two_factor_enabled?: boolean;
}

export type PaymentPromise = {
  id: string;
  user_id: string;
  user_email: string;
  promise_date: string;
  note?: string;
  request_id?: string;
  created_at: string;
};

export type CartItem = {
  id: string;
  name?: string;
  qty: number;
};

export type RequestStatus =
  | 'submitted'           // client just clicked submit
  | 'pending'             // client submitted and waiting for marketing
  | 'priced'            // marketing reviewed and priced
  | 'approved'          // boss approved
  | 'rejected'          // boss rejected
  | 'invoice_ready'     // finance generated invoice
  | 'preparing'         // warehouse preparing
  | 'ready'             // warehouse done, ready for pickup
  | 'on_delivery'       // technician picked up
  | 'delivered'         // technician delivered, waiting for client confirm
  | 'completed'         // client confirmed
  | 'issue'             // client reported issue
  | 'resolved'          // issue resolved
  | 'cancelled';        // client cancelled

export type RequestPriority = 'normal' | 'cito';

export type DbRequest = {
  id: string;
  user_id?: string;
  user_email?: string;
  items: CartItem[];
  total: number;
  price_total?: number;
  status: RequestStatus;
  priority: RequestPriority;
  reason?: string;
  rejection_reason?: string;
  cancel_reason?: string;
  marketing_note?: string;
  assigned_technician_id?: string;
  ready_at?: string;
  on_delivery_at?: string;
  delivered_at?: string;
  created_at: string;
};

// =====================
// NEW TYPES
// =====================

export interface PriceList {
  id: string;
  product_id: string;
  product_name?: string;
  price_regular: number;
  price_kso: number;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  email?: string;
  name: string;
  client_type: ClientType;
  phone?: string;
  address?: string;
  pic_name?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  amount: number;
  tax_amount?: number;
  issued_by?: string;
  due_date?: string;
  paid: boolean;
  paid_at?: string;
  notes?: string;
  created_at: string;
}

export interface DeliveryLog {
  id: string;
  order_id: string;
  technician_id: string;
  proof_url?: string;
  signature_url?: string;
  note?: string;
  delivered_at?: string;
  created_at: string;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  order_id?: string;
  product_name?: string;
  change: number; // positive = added, negative = removed
  reason: string;
  by_user?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  order_id?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Issue {
  id: string;
  order_id: string;
  reported_by: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  resolved_at?: string;
  created_at: string;
}

export interface MonthlyClosing {
  id: string;
  month: number;
  year: number;
  total_revenue: number;
  orders_count: number;
  paid_invoices: number;
  unpaid_invoices: number;
  closed_by?: string;
  notes?: string;
  created_at: string;
}

export interface AutomationEvent {
  id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  retry_count?: number;
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
  event_id: string;
  webhook_url: string;
  status: 'success' | 'failed';
  response?: string | null;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  variables?: string[];
  created_at: string;
}

export interface DocumentFile {
  fileName: string;
  path: string;
  contentType: string;
  signedUrl?: string | null;
}

export type EmailAttachment = DocumentFile;

export interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  service: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface BackupLog {
  id: string;
  backup_type: 'database' | 'storage' | 'full';
  file_url?: string | null;
  status: 'pending' | 'completed' | 'failed' | 'verified' | 'restored' | 'partial';
  created_at: string;
  completed_at?: string | null;
  size?: number | null;
  notes?: string | null;
}

// =====================
// EXISTING TYPES (unchanged)
// =====================

export interface Solution {
  slug: string;
  title: string;
  description: string;
  category: Category;
  image: string;
  specs: string[];
  useCase: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  stock: number;
  status?: string;
  is_priced?: boolean;
  created_at: string;
}

export interface Partner {
  name: string;
  logo: string;
}

export type Location = string;

export interface CMSContent {
  id: string;
  section: string;
  content: Record<string, string>;
}
