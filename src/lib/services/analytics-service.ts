// ============================================================================
// ANALYTICS SERVICE — Dashboards, reports, and performance metrics
// ============================================================================

import { analyticsDb, requestsDb, invoicesDb, productsDb, profilesDb, issuesDb, deliveryLogsDb, activityLogsDb } from '@/lib/db';
import { cmsService } from './cms-service';
import type { Profile, RequestStatus } from '@/types/types';

export const analyticsService = {
  async getOwnerDashboard() {
    const [
      monthlyRevenue,
      orderPipeline,
      productPerformance,
      technicianPerformance,
      allRequests,
      allInvoices,
      allProducts,
      allIssues,
    ] = await Promise.all([
      analyticsDb.getMonthlyRevenue(),
      analyticsDb.getOrderPipeline(),
      analyticsDb.getProductPerformance(10),
      analyticsDb.getTechnicianPerformance(),
      requestsDb.getAll({ page: 1, pageSize: 1 }), // just for count
      invoicesDb.getAll(),
      productsDb.getAll(),
      issuesDb.getAll(),
    ]);

    const totalRevenue = allInvoices.data
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0);

    const openIssues = allIssues.filter(i => i.status !== 'resolved');

    return {
      monthlyRevenue,
      orderPipeline,
      productPerformance,
      technicianPerformance,
      stats: {
        totalOrders: allRequests.count,
        totalRevenue,
        totalProducts: allProducts.count,
        openIssues: openIssues.length,
        paidInvoices: allInvoices.data.filter(i => i.status === 'paid').length,
        unpaidInvoices: allInvoices.data.filter(i => ['issued', 'overdue'].includes(i.status)).length,
      },
    };
  },

  async getAdminDashboard() {
    const [profiles, issues, allRequests] = await Promise.all([
      profilesDb.getAll(),
      issuesDb.getByStatus(['open', 'in_progress']),
      requestsDb.getAll({ page: 1, pageSize: 1 }),
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
      allProfiles,
      techPerformance,
      allActivityLogs,
      allDeliveryLogs,
    ] = await Promise.all([
      profilesDb.getAll(),
      analyticsDb.getTechnicianPerformance(),
      activityLogsDb.getAll(1000),
      deliveryLogsDb.getAll(),
    ]);

    const staffProfiles = allProfiles.data.filter(p => p.role !== 'client');

    // Count actions per user from activity logs
    const actionsByUser: Record<string, number> = {};
    const loginsByUser: Record<string, number> = {};
    for (const log of allActivityLogs) {
      if (!log.user_id) continue;
      actionsByUser[log.user_id] = (actionsByUser[log.user_id] ?? 0) + 1;
      if (log.action === 'sign_in') {
        loginsByUser[log.user_id] = (loginsByUser[log.user_id] ?? 0) + 1;
      }
    }

    // Courier delivery counts
    const courierDeliveries: Record<string, number> = {};
    for (const log of allDeliveryLogs.data) {
      if (log.courier_id) {
        courierDeliveries[log.courier_id] = (courierDeliveries[log.courier_id] ?? 0) + 1;
      }
    }

    // Build per-employee performance data
    const employees = staffProfiles.map((p: Profile) => {
      const techData = techPerformance.find(t => t.technician_id === p.id);
      return {
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: p.role,
        lastLogin: p.last_login,
        totalActions: actionsByUser[p.id] ?? 0,
        totalLogins: loginsByUser[p.id] ?? 0,
        // Role-specific metrics
        deliveries: techData?.total_deliveries ?? courierDeliveries[p.id] ?? 0,
        avgDeliveryHours: techData?.avg_delivery_hours ?? 0,
      };
    });

    // Sort by total actions descending
    employees.sort((a, b) => b.totalActions - a.totalActions);

    // Department summary
    const departmentStats: Record<string, { count: number; totalActions: number; avgActions: number }> = {};
    for (const emp of employees) {
      if (!departmentStats[emp.role]) {
        departmentStats[emp.role] = { count: 0, totalActions: 0, avgActions: 0 };
      }
      departmentStats[emp.role].count++;
      departmentStats[emp.role].totalActions += emp.totalActions;
    }
    for (const dept of Object.values(departmentStats)) {
      dept.avgActions = dept.count > 0 ? Math.round(dept.totalActions / dept.count) : 0;
    }

    return {
      employees,
      departmentStats,
      techPerformance,
      totalStaff: staffProfiles.length,
    };
  },

  async getCompanyDashboard() {
    const [
      monthlyRevenue,
      orderPipeline,
      allRequests,
      allInvoices,
      allDeliveryLogs,
      allProfiles,
      cmsSettings,
      cmsNews,
      cmsEvents,
    ] = await Promise.all([
      analyticsDb.getMonthlyRevenue(),
      analyticsDb.getOrderPipeline(),
      requestsDb.getAll({ page: 1, pageSize: 1 }),
      invoicesDb.getAll(),
      deliveryLogsDb.getAll(),
      profilesDb.getAll(),
      cmsService.getSettings(),
      cmsService.getNews(true),
      cmsService.getEvents(),
    ]);

    const paidInvoices = allInvoices.data.filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);

    // Current month revenue
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthData = monthlyRevenue.find(m => m.month?.startsWith(currentMonthKey));

    // Active staff (non-client roles)
    const staffProfiles = allProfiles.data.filter(p => p.role !== 'client');

    // Order stats by status
    const ordersByStatus: Record<string, number> = {};
    for (const row of orderPipeline) {
      ordersByStatus[row.status] = row.order_count;
    }

    return {
      stats: {
        totalOrders: allRequests.count,
        totalRevenue,
        monthRevenue: currentMonthData?.total_revenue ?? 0,
        totalDeliveries: allDeliveryLogs.count,
        totalStaff: staffProfiles.length,
        totalClients: allProfiles.data.filter(p => p.role === 'client').length,
        paidInvoices: paidInvoices.length,
        unpaidInvoices: allInvoices.data.filter(i => ['issued', 'overdue'].includes(i.status)).length,
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
};
