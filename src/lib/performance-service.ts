import { supabase } from './supabase';
import { logServiceExecution, handleServiceError, withOperationLock } from './service-utils';
import type { Profile, DbRequest, Invoice, DeliveryLog, InventoryLog, Issue, ActivityLog, MonthlyClosing } from '@/types/types';
import { getMonthlyRevenue, getMonthlyOrders, getStockValue, getUnpaidInvoices } from './analytics-service';
import { SYSTEM_USER_ID } from './constants';

export interface EmployeePerformance {
  id: string;
  email: string;
  name: string;
  role: string;
  tasksCompleted: number;
  tasksThisMonth: number;
  revenueHandled: number;
  avgProcessingTime: number;
  onTimeRate: number;
  issuesHandled: number;
  performanceScore: number;
  monthlyPerformance: Array<{ month: string; score: number }>;
}

export interface CompanyKPI {
  totalRevenue: number;
  monthlyRevenue: number;
  totalOrders: number;
  ordersThisMonth: number;
  ordersInProgress: number;
  completedOrders: number;
  avgCompletionTime: number;
  deliverySuccessRate: number;
  issueRate: number;
  stockValue: number;
  unpaidInvoices: number;
  monthlyGrowth: number;
}

export type DepartmentPerformance = Record<string, {
  employeeCount: number;
  totalScore: number;
  avgScore: number;
  ordersProcessed: number;
  revenueGenerated: number;
}>;

const ROLE_METRICS = {
  marketing: {
    tasks: 'requests_priced',
    multiplier: 6,
    penalty: 0
  },
  boss: {
    tasks: 'requests_approved',
    multiplier: 5,
    penalty: 2  // rejections
  },
  finance: {
    tasks: 'invoices_created',
    multiplier: 5,
    bonus: 10  // payments
  },
  warehouse: {
    tasks: 'orders_prepared',
    multiplier: 8,
    penalty: 2  // adjustments
  },
  technician: {
    tasks: 'delivery_logs',
    multiplier: 10,
    penalty: 5  // issues
  },
  admin: {
    tasks: 'issues_resolved',
    multiplier: 10,
    penalty: 0
  }
} as const;

export const performanceService = {
  async getCompanyKPIs(): Promise<CompanyKPI> {
    return withOperationLock('performance:company-kpis', async () => {
      const startedAt = Date.now();

      await logServiceExecution({
        service: 'performance-service',
        action: 'getCompanyKPIs',
        stage: 'start',
        startedAt,
      });

      try {
        const [
          totalRequestsRes,
          totalInvoicesRes,
          totalDeliveriesRes,
          openOrdersRes,
          completedOrdersRes,
          issuesRes,
          stockValue,
          unpaidInvoices
        ] = await Promise.all([
          supabase.from('requests').select('*', { count: 'exact', head: true }),
          supabase.from('invoices').select('*', { count: 'exact', head: true }),
          supabase.from('delivery_logs').select('*', { count: 'exact', head: true }),
          supabase.from('requests').select('*', { count: 'exact', head: true }).not('status', 'in', "('completed','resolved','rejected')"),
          supabase.from('requests').select('*', { count: 'exact', head: true }).in('status', ['completed', 'resolved']),
          supabase.from('issues').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
          getStockValue(),
          getUnpaidInvoices()
        ]);

    const [monthlyRevenueRes, monthlyOrdersRes] = await Promise.all([
      getMonthlyRevenue(),
      getMonthlyOrders()
    ]);
    const monthlyRevenue = Array.isArray(monthlyRevenueRes) ? monthlyRevenueRes : [];
    const monthlyOrders = Array.isArray(monthlyOrdersRes) ? monthlyOrdersRes : [];
    const currentMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.value || 0;
    const currentMonthOrders = monthlyOrders[monthlyOrders.length - 1]?.value || 0;
    const previousMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2]?.value || 0;

        const monthlyGrowth = previousMonthRevenue > 0 
          ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100)
          : 0;

        const totalOrders = totalRequestsRes.count || 0;
        const avgCompletionTime = await calculateAvgCompletionTime();

        const result: CompanyKPI = {
          totalRevenue: currentMonthRevenue,
          monthlyRevenue: currentMonthRevenue,
          totalOrders,
          ordersThisMonth: currentMonthOrders,
          ordersInProgress: openOrdersRes.count || 0,
          completedOrders: completedOrdersRes.count || 0,
          avgCompletionTime,
          deliverySuccessRate: await calculateDeliverySuccessRate(),
          issueRate: (issuesRes.count || 0) / Math.max(totalOrders, 1) * 100,
          stockValue,
          unpaidInvoices: unpaidInvoices.count || 0,
          monthlyGrowth,
        };

        await logServiceExecution({
          service: 'performance-service',
          action: 'getCompanyKPIs',
          stage: 'success',
          startedAt,
          metadata: { ...result } as Record<string, unknown>,
        });

        return result;
      } catch (error) {
        await logServiceExecution({
          service: 'performance-service',
          action: 'getCompanyKPIs',
          stage: 'failure',
          startedAt,
        });
        throw handleServiceError('performance-service', 'getCompanyKPIs', error);
      }
    });
  },

  async getAllEmployeesPerformance(): Promise<EmployeePerformance[]> {
    return withOperationLock('performance:employees', async () => {
      const startedAt = Date.now();

      await logServiceExecution({
        service: 'performance-service',
        action: 'getAllEmployeesPerformance',
        stage: 'start',
        startedAt,
      });

      try {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, name, role')
          .neq('role', 'client')
          .order('name');

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          return [];
        }

        const employees: EmployeePerformance[] = await Promise.all(
          (profiles || []).map(async (profileData: any) => {
            const profile: Profile = {
              ...profileData,
              debt_amount: 0,
              debt_limit: 0,
              two_factor_secret: null,
              two_factor_enabled: false,
            };
            const metrics = await getEmployeeMetrics(profile.id!);
            return {
              ...profile,
              ...metrics,
              performanceScore: calculatePerformanceScore(profile.role!, metrics),
              monthlyPerformance: await getMonthlyPerformance(profile.id!, profile.role!),
            };
          })
        );

        await logServiceExecution({
          service: 'performance-service',
          action: 'getAllEmployeesPerformance',
          stage: 'success',
          startedAt,
          metadata: { employeeCount: employees.length },
        });

        return employees.sort((a, b) => b.performanceScore - a.performanceScore);
      } catch (error) {
        await logServiceExecution({
          service: 'performance-service',
          action: 'getAllEmployeesPerformance',
          stage: 'failure',
          startedAt,
        });
        throw handleServiceError('performance-service', 'getAllEmployeesPerformance', error);
      }
    });
  },

  async getEmployeePerformance(userId: string): Promise<EmployeePerformance | null> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', userId)
      .single();

    if (!profile || !profile.id) return null;

    const metrics = await getEmployeeMetrics(userId);
    const monthlyPerformance = await getMonthlyPerformance(userId, profile.role);

    return {
      ...profile,
      ...metrics,
      performanceScore: calculatePerformanceScore(profile.role, metrics),
      monthlyPerformance,
    };
  },

  async getDepartmentPerformance(department: string): Promise<EmployeePerformance[]> {
    const employees = await this.getAllEmployeesPerformance();
    return employees.filter(e => e.role === department).sort((a, b) => b.performanceScore - a.performanceScore);
  },
};

const getEmployeeMetrics = async (userId: string): Promise<any> => {
  const [
    tasksRes,
    ordersRes,
    deliveriesRes,
    issuesRes,
    revenueRes,
    avgTimeRes
  ] = await Promise.all([
    supabase.from('activity_logs').select('count', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('requests').select('count', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('delivery_logs').select('count', { count: 'exact', head: true }).eq('technician_id', userId),
    supabase.from('issues').select('count', { count: 'exact', head: true }).eq('reported_by', userId),
    supabase.from('invoices').select('amount', { count: 'exact', head: true }).eq('issued_by', userId),
    calculateEmployeeAvgTime(userId)
  ]);

  const thisMonthTasks = await supabase
    .from('activity_logs')
    .select('count', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date().toISOString().slice(0, 7) + '-01');

  return {
    tasksCompleted: tasksRes.count || 0,
    tasksThisMonth: thisMonthTasks.count || 0,
    revenueHandled: (revenueRes.data || []).reduce((sum: number, invoice: { amount: number }) => sum + (invoice.amount || 0), 0),
    avgProcessingTime: avgTimeRes || 0,
    onTimeRate: await calculateOnTimeRate(userId),
    issuesHandled: issuesRes.count || 0,
  };
};

function calculatePerformanceScore(role: string, metrics: any): number {
  const config = ROLE_METRICS[role as keyof typeof ROLE_METRICS];
  if (!config) return 0;

  let score = metrics.tasksCompleted * config.multiplier;
  score -= metrics.issuesHandled * 5;
  // role-specific bonuses
  if (role === 'finance') score += metrics.revenueHandled * 0.00001;
  if (role === 'technician') score += metrics.onTimeRate * 3;

  return Math.round(score);
}

async function getMonthlyPerformance(userId: string, role: string) {
  const { data } = await supabase
    .from('activity_logs')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString());

  return data?.reduce((acc: Record<string, number>, log: { created_at: string }) => {
    const month = new Date(log.created_at).toISOString().slice(0, 7);
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || [];
}

async function calculateAvgCompletionTime() {
  const { data } = await supabase
    .rpc('calculate_avg_completion_time'); // assumes RPC exists or create view
  return data?.avg || 0;
}

async function calculateDeliverySuccessRate() {
  const [totalRes, issueRes] = await Promise.all([
    supabase.from('delivery_logs').select('*', { count: 'exact', head: true }),
    supabase.from('issues').select('*', { count: 'exact', head: true })
  ]);
  return ((totalRes.count || 0) - (issueRes.count || 0)) / Math.max(totalRes.count || 1) * 100;
}

async function calculateEmployeeAvgTime(userId: string) {
  const { data } = await supabase
    .from('activity_logs')
    .select('created_at')
    .eq('user_id', userId);
  
  if (!data || data.length === 0) return 0;
  // Fallback rough estimate as calculating exact DB time spans takes more logic
  return 0;
}

async function calculateOnTimeRate(userId: string) {
  // implementation based on delivery_logs + expected_time
  return 95; // placeholder
}

