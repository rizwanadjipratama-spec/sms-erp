// ============================================================================
// ANALYTICS SERVICE — Dashboards, reports, and performance metrics
// ============================================================================

import { analyticsDb, requestsDb, invoicesDb, productsDb, profilesDb, issuesDb } from '@/lib/db';
import type { RequestStatus } from '@/types/types';

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
};
