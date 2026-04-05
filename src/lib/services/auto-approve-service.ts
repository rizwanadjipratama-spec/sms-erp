// ============================================================================
// AUTO-APPROVE SERVICE — Automated boss approval based on client debt limits
// ============================================================================

import { supabase } from '@/lib/db/client';
import { requestsDb } from '@/lib/db';
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
   * Process all pending priced requests through auto-approve/reject logic.
   *
   * Rules:
   * 1. If debt_amount + order_total > debt_limit → AUTO REJECT
   * 2. If total_spent < min_spend → SKIP (new client, manual review)
   * 3. Otherwise → AUTO APPROVE
   */
  async processAutoApproval(
    requests: DbRequest[],
    clientProfiles: Record<string, Profile>,
    settings: AutoApproveSettings,
    actor: { id: string; email: string; role: UserRole },
  ): Promise<AutoApproveResult> {
    const result: AutoApproveResult = {
      approved: [],
      rejected: [],
      skipped: [],
    };

    for (const request of requests) {
      const clientProfile = request.user_email
        ? clientProfiles[request.user_email]
        : undefined;

      if (!clientProfile) {
        result.skipped.push({ request, reason: 'Profil client tidak ditemukan' });
        continue;
      }

      const orderTotal = request.total_price || 0;
      const debtAmount = clientProfile.debt_amount || 0;
      const debtLimit = clientProfile.debt_limit || settings.auto_approve_default_limit;
      const projectedDebt = debtAmount + orderTotal;

      // Rule 1: Over limit → AUTO REJECT
      if (projectedDebt > debtLimit) {
        try {
          await workflowEngine.transition({
            request,
            actorId: actor.id,
            actorEmail: actor.email,
            actorRole: actor.role,
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
          result.rejected.push(request);
        } catch {
          result.skipped.push({ request, reason: 'Gagal auto-reject' });
        }
        continue;
      }

      // Rule 2: New client (below min spend) → SKIP
      const totalSpent = await this.getClientTotalSpent(clientProfile.id);
      if (totalSpent < settings.auto_approve_min_spend) {
        result.skipped.push({
          request,
          reason: `Client baru — total spend ${formatCurrency(totalSpent)} < minimum ${formatCurrency(settings.auto_approve_min_spend)}`,
        });
        continue;
      }

      // Rule 3: Within limit + sufficient history → AUTO APPROVE
      try {
        await workflowEngine.transition({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
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
        result.approved.push(request);
      } catch {
        result.skipped.push({ request, reason: 'Gagal auto-approve' });
      }
    }

    return result;
  },
};
