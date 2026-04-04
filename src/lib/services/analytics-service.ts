// ============================================================================
// ANALYTICS SERVICE — Dashboards, reports, and performance metrics
// ============================================================================

import { supabase, analyticsDb, requestsDb, invoicesDb, productsDb, profilesDb, issuesDb, deliveryLogsDb, activityLogsDb } from '@/lib/db';
import { cmsService } from './cms-service';
import type { Profile, RequestStatus } from '@/types/types';

export const analyticsService = {
  async getOwnerDashboard() {
    const [
      monthlyRevenue,
      orderPipeline,
      productPerformance,
      technicianPerformance,
      stats
    ] = await Promise.all([
      analyticsDb.getMonthlyRevenue(),
      analyticsDb.getOrderPipeline(),
      analyticsDb.getProductPerformance(10),
      analyticsDb.getTechnicianPerformance(),
      analyticsDb.getDashboardStats()
    ]);

    return {
      monthlyRevenue,
      orderPipeline,
      productPerformance,
      technicianPerformance,
      stats: stats ? {
        totalOrders: stats.total_orders,
        totalRevenue: Number(stats.total_revenue),
        totalProducts: stats.total_products,
        openIssues: stats.open_issues,
        paidInvoices: stats.paid_invoices,
        unpaidInvoices: stats.unpaid_invoices,
      } : {
        totalOrders: 0,
        totalRevenue: 0,
        totalProducts: 0,
        openIssues: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
      },
    };
  },

  async getAdminDashboard(branchId?: string) {
    const [profiles, issues, allRequests] = await Promise.all([
      profilesDb.getAll(),
      issuesDb.getByStatus(['open', 'in_progress'], branchId),
      requestsDb.getAll({ page: 1, pageSize: 1 }, branchId),
    ]);

    return {
      users: profiles.data,
      totalUsers: profiles.count,
      openIssues: issues,
      totalRequests: allRequests.count,
    };
  },

  async getMonthlyRevenue() {
    return analyticsDb.getMonthlyRevenue();
  },

  async getOrderPipeline() {
    return analyticsDb.getOrderPipeline();
  },

  async getProductPerformance(limit?: number) {
    return analyticsDb.getProductPerformance(limit);
  },

  async getTechnicianPerformance() {
    return analyticsDb.getTechnicianPerformance();
  },

  async getEmployeePerformance() {
    const [
      employees,
      departmentStatsData,
      techPerformance,
    ] = await Promise.all([
      analyticsDb.getEmployeePerformance(),
      analyticsDb.getDepartmentStats(),
      analyticsDb.getTechnicianPerformance(),
    ]);

    // Build per-employee performance data combining tech stats if available
    const mappedEmployees = employees.map(emp => {
      const techData = techPerformance.find(t => t.technician_id === emp.id);
      return {
        id: emp.id,
        name: emp.name || emp.email,
        email: emp.email,
        role: emp.role,
        lastLogin: emp.last_login,
        totalActions: emp.total_actions ?? 0,
        totalLogins: emp.total_logins ?? 0,
        // Tech deliveries override generic courier deliveries if present
        deliveries: techData?.total_deliveries ?? emp.delivery_count ?? 0,
        avgDeliveryHours: techData?.avg_delivery_hours ?? 0,
        avgRating: emp.avg_rating ?? 0,
      };
    });

    // Format department stats
    const departmentStats: Record<string, { count: number; totalActions: number; avgActions: number }> = {};
    for (const stat of departmentStatsData) {
      departmentStats[stat.role] = {
        count: stat.staff_count,
        totalActions: stat.total_actions,
        avgActions: stat.avg_actions,
      };
    }

    return {
      employees: mappedEmployees,
      departmentStats,
      techPerformance,
      totalStaff: mappedEmployees.length,
    };
  },

  async getCompanyDashboard(branchId?: string) {
    const [
      monthlyRevenue,
      orderPipeline,
      stats,
      cmsSettings,
      cmsNews,
      cmsEvents,
    ] = await Promise.all([
      analyticsDb.getMonthlyRevenue(),
      analyticsDb.getOrderPipeline(),
      analyticsDb.getDashboardStats(),
      cmsService.getSettings(),
      cmsService.getNews(true),
      cmsService.getEvents(),
    ]);

    // Current month revenue
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthData = monthlyRevenue.find(m => m.month?.startsWith(currentMonthKey));

    // Order stats by status
    const ordersByStatus: Record<string, number> = {};
    for (const row of orderPipeline) {
      ordersByStatus[row.status] = row.order_count;
    }

    return {
      stats: stats ? {
        totalOrders: stats.total_orders,
        totalRevenue: Number(stats.total_revenue),
        monthRevenue: currentMonthData?.total_revenue ?? 0,
        totalDeliveries: stats.total_deliveries,
        totalStaff: stats.total_staff,
        totalClients: stats.total_clients,
        paidInvoices: stats.paid_invoices,
        unpaidInvoices: stats.unpaid_invoices,
      } : {
        totalOrders: 0,
        totalRevenue: 0,
        monthRevenue: 0,
        totalDeliveries: 0,
        totalStaff: 0,
        totalClients: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
      },
      monthlyRevenue,
      ordersByStatus,
      announcement: cmsSettings?.announcement_is_active
        ? { text: cmsSettings.announcement_text, link: cmsSettings.announcement_link }
        : null,
      employeeOfMonth: cmsSettings?.employee_of_month ?? null,
      news: cmsNews.slice(0, 5),
      events: cmsEvents.slice(0, 5),
    };
  },

  async getBranchPerformance() {
    const { data } = await supabase.from('branches').select('*');
    const branches: any[] = data || [];
    
    const { data: invData } = await supabase.from('invoices').select('branch_id, total, status');
    const invoices: any[] = invData || [];
    
    const { data: issData } = await supabase.from('issues').select('branch_id, status');
    const issues: any[] = issData || [];

    const result = branches.map(b => {
      const branchInvoices = invoices.filter(i => i.branch_id === b.id);
      const branchIssues = issues.filter(i => i.branch_id === b.id);
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        totalRevenue: branchInvoices.filter(i => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.total), 0),
        totalInvoices: branchInvoices.length,
        openIssues: branchIssues.filter(i => i.status !== 'resolved').length,
      };
    });

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  },

  async getDeliveryStats() {
    const { data } = await supabase.from('delivery_logs').select('status, created_at, courier_id').order('created_at', { ascending: false });
    const logs: any[] = data || [];
    
    const statusCounts: Record<string, number> = {};
    logs.forEach((log: any) => {
      statusCounts[log.status] = (statusCounts[log.status] || 0) + 1;
    });

    return {
      totalDeliveries: logs?.length || 0,
      statusBreakdown: statusCounts,
      recentLogs: (logs || []).slice(0, 20),
    };
  },
};
