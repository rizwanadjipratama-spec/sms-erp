// ============================================================================
// AUTO-APPROVE SERVICE — Automated boss approval based on client debt limits
// ============================================================================

import { supabase } from '@/lib/db/client';
import { requestsDb, profilesDb } from '@/lib/db';
import { workflowEngine } from './workflow-engine';
import { formatCurrency, formatOrderId } from '@/lib/format-utils';
import type { DbRequest, Profile, UserRole } from '@/types/types';

export interface AutoApproveSettings {
  auto_approve_enabled: boolean;
  auto_approve_min_spend: number;
  auto_approve_default_limit: number;
}

export interface AutoApproveResult {
  approved: DbRequest[];
  rejected: DbRequest[];
  skipped: { request: DbRequest; reason: string }[];
}

export const autoApproveService = {
  /**
   * Fetch auto-approve settings for a branch
   */
  async getSettings(branchId: string): Promise<AutoApproveSettings> {
    const { data, error } = await supabase
      .from('branches')
      .select('auto_approve_enabled, auto_approve_min_spend, auto_approve_default_limit')
      .eq('id', branchId)
      .single();

    if (error || !data) {
      return {
        auto_approve_enabled: false,
        auto_approve_min_spend: 5000000,
        auto_approve_default_limit: 500000,
      };
    }

    return {
      auto_approve_enabled: data.auto_approve_enabled ?? false,
      auto_approve_min_spend: data.auto_approve_min_spend ?? 5000000,
      auto_approve_default_limit: data.auto_approve_default_limit ?? 500000,
    };
  },

  /**
   * Save auto-approve settings for a branch
   */
  async updateSettings(branchId: string, settings: Partial<AutoApproveSettings>): Promise<void> {
    const { error } = await supabase
      .from('branches')
      .update(settings)
      .eq('id', branchId);

    if (error) throw new Error(error.message);
  },

  /**
   * Calculate total lifetime spend for a client (completed/resolved orders)
   */
  async getClientTotalSpent(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('requests')
      .select('total_price')
      .eq('user_id', userId)
      .in('status', ['completed', 'resolved']);

    if (error || !data) return 0;
    return data.reduce((sum, r) => sum + (r.total_price || 0), 0);
  },



  /**
   * Process a single request automatically (used in background side-effects)
   */
  async processSingleRequest(
    request: DbRequest,
    actor: { id: string; email: string }
  ): Promise<void> {
    if (!request.branch_id || !request.user_email) return;

    const settings = await this.getSettings(request.branch_id);
    if (!settings.auto_approve_enabled) return;

    const profile = await profilesDb.getByEmail(request.user_email);
    if (!profile) return;

    const orderTotal = request.total_price || 0;
    const debtAmount = profile.debt_amount || 0;
    const debtLimit = profile.debt_limit || settings.auto_approve_default_limit;
    const projectedDebt = debtAmount + orderTotal;

    // Boss actor override so workflow engine permits the transition
    const bossActor = {
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: 'boss' as UserRole,
    };

    if (projectedDebt > debtLimit) {
      try {
        await workflowEngine.transition({
          request,
          ...bossActor,
          nextStatus: 'rejected',
          action: 'reject',
          message: `[AUTO] Request ${formatOrderId(request.id)} ditolak otomatis — melebihi limit piutang (${formatCurrency(projectedDebt)} > ${formatCurrency(debtLimit)})`,
          type: 'error',
          notifyRoles: ['admin', 'owner', 'marketing'],
          extraUpdates: {
            note: `Auto-rejected: Piutang ${formatCurrency(projectedDebt)} melebihi limit ${formatCurrency(debtLimit)}`,
            rejection_reason: `Auto-rejected: Piutang ${formatCurrency(projectedDebt)} melebihi limit ${formatCurrency(debtLimit)}`,
          },
          metadata: {
            previous_status: request.status,
            auto_action: 'reject',
            projected_debt: projectedDebt,
            debt_limit: debtLimit,
          },
        });
      } catch (err) {
        console.error('Auto-reject failed:', err);
      }
      return;
    }

    const totalSpent = await this.getClientTotalSpent(profile.id);
    if (totalSpent < settings.auto_approve_min_spend) {
      // Skip -> Leave as priced for manual review
      return;
    }

    try {
      await workflowEngine.transition({
        request,
        ...bossActor,
        nextStatus: 'approved',
        action: 'approve',
        message: `[AUTO] Request ${formatOrderId(request.id)} disetujui otomatis — dalam limit piutang`,
        type: 'success',
        notifyRoles: ['finance', 'admin', 'owner'],
        metadata: {
          previous_status: request.status,
          auto_action: 'approve',
          projected_debt: projectedDebt,
          debt_limit: debtLimit,
          total_spent: totalSpent,
        },
      });
    } catch (err) {
      console.error('Auto-approve failed:', err);
    }
  },
};
