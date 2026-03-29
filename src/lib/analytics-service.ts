import { deliveryService } from './delivery-service';
import { inventoryService } from './inventory-service';
import { supabase } from './supabase';
import type { ActivityLog, DbRequest, Invoice, InvoiceStatus, MonthlyClosing, Product, Profile } from '@/types/types';

type MonthlyMetric = {
  month: string;
  value: number;
};

type TopCustomer = {
  userId: string;
  userEmail: string;
  totalSpending: number;
  invoicesCount: number;
};

type TopProduct = {
  productId: string;
  productName: string;
  qtySold: number;
};

type EmployeePerformance = {
  employeeId: string;
  employeeName: string;
  role: string;
  deliveriesCompleted: number;
};

type OwnerDashboardStats = {
  totalRevenueThisMonth: number;
  paidRevenueThisMonth: number;
  totalOrdersThisMonth: number;
  unpaidInvoices: number;
  stockValue: number;
  ordersInProgress: number;
  deliveriesInProgress: number;
  openIssues: number;
};

type OwnerDashboardBundle = {
  stats: Awaited<ReturnType<typeof getOwnerDashboardStats>>;
  revenue: Awaited<ReturnType<typeof getRevenueAnalytics>>;
  orders: Awaited<ReturnType<typeof getOrdersAnalytics>>;
  inventory: Awaited<ReturnType<typeof getInventoryAnalytics>>;
  delivery: Awaited<ReturnType<typeof getDeliveryAnalytics>>;
  topCustomers: TopCustomer[];
  topProducts: TopProduct[];
  employeePerformance: EmployeePerformance[];
  recentActivity: ActivityLog[];
  recentOrders: DbRequest[];
  openIssues: number;
};

type RequestFetchOptions = {
  fields?: string;
  limit?: number;
  since?: string;
  statuses?: string[];
};

type InvoiceFetchOptions = {
  fields?: string;
  limit?: number;
  since?: string;
  status?: InvoiceStatus | InvoiceStatus[];
};

const ANALYTICS_MONTH_WINDOW = 12;

function monthKey(dateValue?: string | null) {
  if (!dateValue) return null;
  return new Date(dateValue).toISOString().slice(0, 7);
}

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getWindowStart(months = ANALYTICS_MONTH_WINDOW) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).toISOString();
}

async function fetchRequests(options: RequestFetchOptions = {}) {
  const { fields = 'id, user_id, user_email, status, created_at', limit, since, statuses } = options;
  let query = supabase
    .from('requests')
    .select(fields)
    .order('created_at', { ascending: false });

  if (since) query = query.gte('created_at', since);
  if (statuses?.length) query = query.in('status', statuses);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return ((data || []) as unknown) as DbRequest[];
}

async function fetchInvoices(options: InvoiceFetchOptions = {}) {
  const {
    fields = 'id, order_id, invoice_number, total, status, paid_at, created_at',
    limit,
    since,
    status,
  } = options;
  let query = supabase
    .from('invoices')
    .select(fields)
    .order('created_at', { ascending: false });

  if (since) query = query.gte('created_at', since);
  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return ((data || []) as unknown) as Invoice[];
}

async function fetchProductsAndPrices() {
  const [productsRes, pricesRes] = await Promise.all([
    supabase.from('products').select('id, name, stock, min_stock, unit, category, is_active, is_priced'),
    supabase.from('price_list').select('product_id, price_regular'),
  ]);

  if (productsRes.error) {
    console.error('Supabase error:', productsRes.error);
    throw new Error(productsRes.error.message);
  }
  if (pricesRes.error) {
    console.error('Supabase error:', pricesRes.error);
    throw new Error(pricesRes.error.message);
  }

  return {
    products: (productsRes.data || []) as Product[],
    prices: (pricesRes.data || []) as Array<{ product_id: string; price_regular: number }>,
  };
}

export async function getMonthlyRevenue(): Promise<MonthlyMetric[]> {
  const invoices = await fetchInvoices({
    fields: 'total, status, created_at',
    since: getWindowStart(),
  });
  const grouped = invoices.reduce<Record<string, number>>((acc, invoice) => {
    if (invoice.status !== 'paid') return acc;
    const key = monthKey(invoice.created_at);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + invoice.total;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));
}

export async function getMonthlyOrders(): Promise<MonthlyMetric[]> {
  const requests = await fetchRequests({
    fields: 'created_at',
    since: getWindowStart(),
  });
  const grouped = requests.reduce<Record<string, number>>((acc, request) => {
    const key = monthKey(request.created_at);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));
}

export async function getMonthlyDeliveries(): Promise<MonthlyMetric[]> {
  const { data, error } = await supabase
    .from('delivery_logs')
    .select('delivered_at')
    .gte('delivered_at', getWindowStart())
    .order('delivered_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }

  const grouped = ((data || []) as Array<{ delivered_at?: string }>).reduce<Record<string, number>>((acc, log) => {
    const key = monthKey(log.delivered_at);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));
}

export async function getStockValue() {
  const { products, prices } = await fetchProductsAndPrices();
  const priceMap = prices.reduce<Record<string, number>>((acc, row) => {
    acc[row.product_id] = row.price_regular;
    return acc;
  }, {});

  return products.reduce((sum, product) => sum + product.stock * (priceMap[product.id] || 0), 0);
}

export async function getOpenIssuesCount() {
  const { count, error } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'resolved');

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return count || 0;
}

export async function getUnpaidInvoices() {
  const invoices = await fetchInvoices({
    fields: 'id, order_id, invoice_number, total, status, due_date, created_at',
    status: ['draft', 'issued', 'overdue'],
    limit: 50,
  });
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .in('status', ['draft', 'issued', 'overdue']);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }

  const unpaid = invoices.filter((invoice) => invoice.status !== 'paid');
  return {
    count: count || 0,
    totalAmount: unpaid.reduce((sum, invoice) => sum + invoice.total, 0),
    invoices: unpaid,
  };
}

export async function getTopCustomers(limit = 5): Promise<TopCustomer[]> {
  const since = getWindowStart(12);
  const [invoices, requests] = await Promise.all([
    fetchInvoices({ fields: 'order_id, total, status', since }),
    fetchRequests({ fields: 'id, user_id, user_email', since }),
  ]);

  const requestMap = requests.reduce<Record<string, DbRequest>>((acc, request) => {
    acc[request.id] = request;
    return acc;
  }, {});

  const grouped = invoices.reduce<Record<string, TopCustomer>>((acc, invoice) => {
    const request = requestMap[invoice.order_id];
    if (!request?.user_id) return acc;
    const current = acc[request.user_id] || {
      userId: request.user_id,
      userEmail: request.user_email || 'unknown',
      totalSpending: 0,
      invoicesCount: 0,
    };
    current.totalSpending += invoice.total;
    current.invoicesCount += 1;
    acc[request.user_id] = current;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.totalSpending - a.totalSpending)
    .slice(0, limit);
}

export async function getTopProducts(limit = 5): Promise<TopProduct[]> {
  const since = getWindowStart(12);
  const [logsRes, productsRes] = await Promise.all([
    supabase.from('inventory_logs').select('product_id, change').lt('change', 0).gte('created_at', since),
    supabase.from('products').select('id, name'),
  ]);

  if (logsRes.error) {
    console.error('Supabase error:', logsRes.error);
    throw new Error(logsRes.error.message);
  }
  if (productsRes.error) {
    console.error('Supabase error:', productsRes.error);
    throw new Error(productsRes.error.message);
  }

  const productMap = ((productsRes.data || []) as Product[]).reduce<Record<string, string>>((acc, product) => {
    acc[product.id] = product.name;
    return acc;
  }, {});

  const grouped = ((logsRes.data || []) as Array<{ product_id: string; change: number }>).reduce<Record<string, number>>(
    (acc, log) => {
      acc[log.product_id] = (acc[log.product_id] || 0) + Math.abs(log.change);
      return acc;
    },
    {}
  );

  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, qtySold]) => ({
      productId,
      productName: productMap[productId] || productId,
      qtySold,
    }));
}

export async function getEmployeePerformance(limit = 5): Promise<EmployeePerformance[]> {
  const since = getWindowStart(12);
  const [logsRes, profilesRes] = await Promise.all([
    supabase.from('delivery_logs').select('technician_id').gte('created_at', since),
    supabase.from('profiles').select('id, email, name, role').eq('role', 'technician'),
  ]);

  if (logsRes.error) {
    console.error('Supabase error:', logsRes.error);
    throw new Error(logsRes.error.message);
  }
  if (profilesRes.error) {
    console.error('Supabase error:', profilesRes.error);
    throw new Error(profilesRes.error.message);
  }

  const profileMap = ((profilesRes.data || []) as Profile[]).reduce<Record<string, Profile>>((acc, profile) => {
    if (profile.id) acc[profile.id] = profile;
    return acc;
  }, {});

  const grouped = ((logsRes.data || []) as Array<{ technician_id: string }>).reduce<Record<string, number>>((acc, log) => {
    acc[log.technician_id] = (acc[log.technician_id] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([employeeId, deliveriesCompleted]) => ({
      employeeId,
      employeeName: profileMap[employeeId]?.name || profileMap[employeeId]?.email || employeeId,
      role: profileMap[employeeId]?.role || 'technician',
      deliveriesCompleted,
    }));
}

export async function getRevenueAnalytics() {
  const [monthlyRevenue, invoices] = await Promise.all([
    getMonthlyRevenue(),
    fetchInvoices({
      fields: 'total, status, created_at',
      since: getWindowStart(),
    }),
  ]);
  const currentMonth = getCurrentMonthKey();
  const paidRevenueThisMonth = invoices
    .filter((invoice) => invoice.status === 'paid' && monthKey(invoice.created_at) === currentMonth)
    .reduce((sum, invoice) => sum + invoice.total, 0);

  return {
    monthlyRevenue,
    paidRevenueThisMonth,
    totalPaidRevenue: invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0),
  };
}

export async function getOrdersAnalytics() {
  const [monthlyOrders, requests] = await Promise.all([
    getMonthlyOrders(),
    fetchRequests({
      fields: 'id, status, created_at, user_email, total_price',
      since: getWindowStart(),
    }),
  ]);

  const currentMonth = getCurrentMonthKey();
  const totalOrdersThisMonth = requests.filter((request) => monthKey(request.created_at) === currentMonth).length;
  const ordersInProgress = requests.filter(
    (request) => !['completed', 'resolved', 'rejected'].includes(request.status)
  ).length;

  return {
    monthlyOrders,
    totalOrdersThisMonth,
    ordersInProgress,
    recentOrders: requests.slice(0, 10),
  };
}

export async function getInventoryAnalytics() {
  const [inventory, stockValue] = await Promise.all([
    inventoryService.getInventoryAnalytics(),
    getStockValue(),
  ]);

  return {
    ...inventory,
    stockValue,
  };
}

export async function getDeliveryAnalytics() {
  const [delivery, requests] = await Promise.all([
    deliveryService.getDeliveryAnalytics(),
    fetchRequests({
      fields: 'status',
      statuses: ['ready', 'on_delivery'],
    }),
  ]);

  return {
    ...delivery,
    deliveriesInProgress: requests.filter((request) => ['ready', 'on_delivery'].includes(request.status)).length,
  };
}

export async function getMonthlyClosingSummary() {
  const { data, error } = await supabase
    .from('monthly_closing')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return (data || []) as MonthlyClosing[];
}

export async function getOwnerDashboardStats(): Promise<OwnerDashboardStats> {
  const [revenue, orders, unpaid, stockValue, openIssues, delivery] = await Promise.all([
    getRevenueAnalytics().catch(err => { console.error('Revenue analytics failed:', err); return { monthlyRevenue: [], paidRevenueThisMonth: 0, totalPaidRevenue: 0 }; }),
    getOrdersAnalytics().catch(err => { console.error('Orders analytics failed:', err); return { monthlyOrders: [], totalOrdersThisMonth: 0, ordersInProgress: 0, recentOrders: [] }; }),
    getUnpaidInvoices().catch(err => { console.error('Unpaid invoices analytics failed:', err); return { count: 0, totalAmount: 0, invoices: [] }; }),
    getStockValue().catch(err => { console.error('Stock value analytics failed:', err); return 0; }),
    getOpenIssuesCount().catch(err => { console.error('Issues analytics failed:', err); return 0; }),
    getDeliveryAnalytics().catch(err => { console.error('Delivery analytics failed:', err); return { deliveriesInProgress: 0 }; }),
  ]);

  const currentMonth = getCurrentMonthKey();

  return {
    totalRevenueThisMonth: revenue.monthlyRevenue.find((item) => item.month === currentMonth)?.value || 0,
    paidRevenueThisMonth: revenue.paidRevenueThisMonth,
    totalOrdersThisMonth: orders.totalOrdersThisMonth,
    unpaidInvoices: (unpaid as any).count || 0,
    stockValue,
    ordersInProgress: orders.ordersInProgress,
    deliveriesInProgress: (delivery as any).deliveriesInProgress || 0,
    openIssues,
  };
}


export async function getOwnerDashboardBundle(): Promise<OwnerDashboardBundle> {
  const windowStart = getWindowStart();
  const [
    requests,
    recentOrders,
    invoices,
    deliveryAnalytics,
    inventoryAnalytics,
    recentActivity,
    openIssuesCount,
    profilesRes,
    topCustomers,
    topProducts,
    ordersInProgressRes,
    deliveriesInProgressRes,
    unpaidInvoicesRes,
  ] =
    await Promise.all([
      fetchRequests({
        fields: 'id, user_id, user_email, status, created_at, total_price, updated_at',
        since: windowStart,
      }),
      getRecentOrders(),
      fetchInvoices({
        fields: 'id, order_id, invoice_number, total, status, due_date, created_at',
        since: windowStart,
      }),
      deliveryService.getDeliveryAnalytics(),
      inventoryService.getInventoryAnalytics(),
      getRecentActivityLogs(),
      getOpenIssuesCount(),
      supabase.from('profiles').select('id, email, name, role').eq('role', 'technician'),
      getTopCustomers(),
      getTopProducts(),
      supabase
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '(completed,resolved,rejected)'),
      supabase
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ready', 'on_delivery']),
      supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'issued', 'overdue']),
    ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const currentMonth = getCurrentMonthKey();
  const monthlyRevenueMap = invoices.reduce<Record<string, number>>((acc, invoice) => {
    if (invoice.status !== 'paid') return acc;
    const key = monthKey(invoice.created_at);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + invoice.total;
    return acc;
  }, {});

  const monthlyOrdersMap = requests.reduce<Record<string, number>>((acc, request) => {
    const key = monthKey(request.created_at);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const technicianProfiles = (profilesRes.data || []) as Profile[];
  const profileMap = technicianProfiles.reduce<Record<string, Profile>>((acc, profile) => {
    if (profile.id) acc[profile.id] = profile;
    return acc;
  }, {});

  const employeePerformance = deliveryAnalytics.deliveriesPerTechnician
    .slice(0, 5)
    .map((entry) => ({
      employeeId: entry.technicianId,
      employeeName:
        profileMap[entry.technicianId]?.name ||
        profileMap[entry.technicianId]?.email ||
        entry.technicianId,
      role: profileMap[entry.technicianId]?.role || 'technician',
      deliveriesCompleted: entry.deliveries,
    }));

  const monthlyRevenue = Object.entries(monthlyRevenueMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));

  const monthlyOrders = Object.entries(monthlyOrdersMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));

  const totalOrdersThisMonth = requests.filter((request) => monthKey(request.created_at) === currentMonth).length;
  const ordersInProgress = ordersInProgressRes.count || 0;
  const unpaidInvoices = unpaidInvoicesRes.count || 0;
  const paidRevenueThisMonth = invoices
    .filter((invoice) => invoice.status === 'paid' && monthKey(invoice.created_at) === currentMonth)
    .reduce((sum, invoice) => sum + invoice.total, 0);

  return {
    stats: {
      totalRevenueThisMonth: monthlyRevenue.find((item) => item.month === currentMonth)?.value || 0,
      paidRevenueThisMonth,
      totalOrdersThisMonth,
      unpaidInvoices,
      stockValue: inventoryAnalytics.stockValue,
      ordersInProgress,
      deliveriesInProgress: deliveriesInProgressRes.count || 0,
      openIssues: openIssuesCount,
    },
    revenue: {
      monthlyRevenue,
      paidRevenueThisMonth,
      totalPaidRevenue: invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0),
    },
    orders: {
      monthlyOrders,
      totalOrdersThisMonth,
      ordersInProgress,
      recentOrders: recentOrders.slice(0, 10),
    },
    inventory: inventoryAnalytics,
    delivery: {
      ...deliveryAnalytics,
      deliveriesInProgress: deliveriesInProgressRes.count || 0,
    },
    topCustomers,
    topProducts,
    employeePerformance,
    recentActivity,
    recentOrders: recentOrders.slice(0, 10),
    openIssues: openIssuesCount,
  };
}

export async function getRecentActivityLogs(limit = 12): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, user_id, user_email, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return (data || []) as ActivityLog[];
}

export async function getRecentOrders(limit = 10): Promise<DbRequest[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('id, user_id, user_email, total_price, status, priority, created_at, updated_at, rejection_reason')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message);
  }
  return (data || []) as DbRequest[];
}
