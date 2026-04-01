// ============================================================================
// TECHNICIAN SERVICE — Issue management, area assignments, knowledge base
// Created by: Antigravity
// ============================================================================

import {
  serviceIssuesDb, serviceIssueLogsDb, technicianAreasDb,
  areaTransfersDb, notificationsDb, profilesDb, storageDb,
  activityLogsDb,
} from '@/lib/db';
import type {
  Actor, ServiceIssue, ServiceIssueStatus, TechnicianArea,
  AreaTransferRequest,
} from '@/types/types';
import { supabase } from '@/lib/supabase';

const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

const STATUS_ORDER: ServiceIssueStatus[] = ['open', 'otw', 'arrived', 'working', 'completed'];

export const technicianService = {
  // ── Area Management ────────────────────────────────────────────────────
  async getMyAreas(technicianId: string): Promise<TechnicianArea[]> {
    return technicianAreasDb.getByTechnician(technicianId);
  },

  async getAllAreas(): Promise<TechnicianArea[]> {
    return technicianAreasDb.getAll();
  },

  // ── Issue Queries ──────────────────────────────────────────────────────
  async getMyIssues(technicianId: string): Promise<ServiceIssue[]> {
    return serviceIssuesDb.getByAssignee(technicianId);
  },

  async getMyAreaIssues(technicianId: string): Promise<ServiceIssue[]> {
    const areas = await technicianAreasDb.getByTechnician(technicianId);
    const areaIds = areas.map(a => a.id);
    if (!areaIds.length) return [];
    return serviceIssuesDb.getByAreas(areaIds);
  },

  async getAllOpenIssues(): Promise<ServiceIssue[]> {
    return serviceIssuesDb.getAllOpen();
  },

  // ── Take Issue ─────────────────────────────────────────────────────────
  async takeIssue(issueId: string, actor: Actor): Promise<ServiceIssue> {
    if (actor.role !== 'technician') {
      throw new Error('Only technicians can take issues');
    }

    const { error: rpcError } = await supabase.rpc('rpc_technician_take_job', {
      p_issue_id: issueId,
      p_tech_id: actor.id,
    });
    
    if (rpcError) {
      throw new Error(rpcError.message || 'Failed to take issue. It may already be assigned or no longer open.');
    }

    const updated = await serviceIssuesDb.getById(issueId);
    if (!updated) throw new Error('Issue not found after assignment');

    const now = new Date().toISOString();

    await serviceIssueLogsDb.create({
      issue_id: issueId,
      from_status: 'open',
      to_status: 'otw',
      changed_by: actor.id,
      note: 'Issue taken by technician',
    });

    // Notify the reporter
    if (updated.reported_by) {
      await notificationsDb.create({
        user_id: updated.reported_by,
        title: 'Technician Assigned',
        message: `A technician is on the way to resolve your issue at ${updated.location}`,
        type: 'info',
        action_url: '/dashboard/client/issues',
      });
    }

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'take_issue',
      entity_type: 'service_issue',
      entity_id: issueId,
    });

    return updated;
  },

  // ── Update Issue Status ────────────────────────────────────────────────
  async updateIssueStatus(
    issueId: string,
    newStatus: ServiceIssueStatus,
    actor: Actor,
    note?: string,
  ): Promise<ServiceIssue> {
    if (actor.role !== 'technician' && actor.role !== 'admin') {
      throw new Error('Only technicians can update issue status');
    }

    const issue = await serviceIssuesDb.getById(issueId);
    if (!issue) throw new Error('Issue not found');

    if (actor.role === 'technician' && issue.assigned_to !== actor.id) {
      throw new Error('You are not assigned to this issue');
    }

    // Validate status ordering
    const currentIdx = STATUS_ORDER.indexOf(issue.status);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    if (newIdx <= currentIdx) {
      throw new Error(`Cannot go from ${issue.status} to ${newStatus}`);
    }

    if (newStatus === 'completed') {
      return this.completeIssue(issueId, actor, note || '');
    }

    const updated = await serviceIssuesDb.update(issueId, { status: newStatus });

    await serviceIssueLogsDb.create({
      issue_id: issueId,
      from_status: issue.status,
      to_status: newStatus,
      changed_by: actor.id,
      note,
    });

    // Notify reporter on status change
    if (issue.reported_by) {
      const statusLabels: Record<ServiceIssueStatus, string> = {
        open: 'Open',
        otw: 'On The Way',
        arrived: 'Arrived',
        working: 'Working',
        completed: 'Completed',
      };
      await notificationsDb.create({
        user_id: issue.reported_by,
        title: 'Issue Status Updated',
        message: `Technician status: ${statusLabels[newStatus]}`,
        type: 'info',
        action_url: '/dashboard/client/issues',
      });
    }

    return updated;
  },

  // ── Complete Issue ─────────────────────────────────────────────────────
  async completeIssue(
    issueId: string,
    actor: Actor,
    resolutionNote: string,
  ): Promise<ServiceIssue> {
    if (!resolutionNote.trim()) {
      throw new Error('Resolution note is required to complete an issue');
    }

    const issue = await serviceIssuesDb.getById(issueId);
    if (!issue) throw new Error('Issue not found');

    const now = new Date().toISOString();
    const updated = await serviceIssuesDb.update(issueId, {
      status: 'completed',
      resolution_note: resolutionNote,
      resolved_at: now,
    });

    await serviceIssueLogsDb.create({
      issue_id: issueId,
      from_status: issue.status,
      to_status: 'completed',
      changed_by: actor.id,
      note: resolutionNote,
    });

    if (issue.reported_by) {
      await notificationsDb.create({
        user_id: issue.reported_by,
        title: 'Issue Resolved',
        message: `Your issue at ${issue.location} has been resolved`,
        type: 'success',
        action_url: '/dashboard/client/issues',
      });
    }

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'complete_issue',
      entity_type: 'service_issue',
      entity_id: issueId,
      metadata: { resolution_note: resolutionNote },
    });

    return updated;
  },

  // ── Report Issue (Client) ──────────────────────────────────────────────
  async reportIssue(
    data: {
      location: string;
      device_name?: string;
      product_id?: string;
      description: string;
      notes?: string;
      photo_urls?: string[];
    },
    actor: Actor,
  ): Promise<ServiceIssue> {
    const issue = await serviceIssuesDb.create({
      reported_by: actor.id,
      location: data.location,
      device_name: data.device_name,
      product_id: data.product_id,
      description: data.description,
      notes: data.notes,
      photo_urls: data.photo_urls || [],
      status: 'open',
    });

    // Notify all technicians about new issue
    const technicians = await profilesDb.getByRole('technician');
    if (technicians.length) {
      await notificationsDb.createMany(
        technicians.map(t => ({
          user_id: t.id,
          title: 'New Service Issue',
          message: `New issue reported at ${data.location}: ${data.description.slice(0, 100)}`,
          type: 'warning' as const,
          action_url: '/dashboard/technician',
        }))
      );
    }

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'report_issue',
      entity_type: 'service_issue',
      entity_id: issue.id,
    });

    return issue;
  },

  // ── Upload Issue Photos ────────────────────────────────────────────────
  async uploadIssuePhoto(file: File, issueId: string): Promise<string> {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Allowed: PNG, JPG, JPEG, WEBP');
    }
    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error('File too large. Max: 10MB');
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `issues/${issueId}/${crypto.randomUUID()}.${ext}`;
    return storageDb.upload('service-issues', path, file);
  },

  // ── Knowledge Base ─────────────────────────────────────────────────────
  async getKnowledgeBase(search?: string): Promise<ServiceIssue[]> {
    return serviceIssuesDb.getCompleted(search);
  },

  // ── Issue History/Logs ─────────────────────────────────────────────────
  async getIssueLogs(issueId: string) {
    return serviceIssueLogsDb.getByIssue(issueId);
  },

  // ── Area Transfers ─────────────────────────────────────────────────────
  async requestAreaTransfer(
    areaId: string,
    toTechnicianId: string,
    actor: Actor,
    note?: string,
  ): Promise<AreaTransferRequest> {
    if (actor.role !== 'technician') {
      throw new Error('Only technicians can request area transfers');
    }

    const area = await technicianAreasDb.getById(areaId);
    if (!area) throw new Error('Area not found');
    if (area.technician_id !== actor.id) {
      throw new Error('You can only transfer your own areas');
    }

    const transfer = await areaTransfersDb.create({
      area_id: areaId,
      from_technician_id: actor.id,
      to_technician_id: toTechnicianId,
      status: 'pending',
      note,
    });

    // Notify the target technician
    const fromProfile = await profilesDb.getById(actor.id);
    await notificationsDb.create({
      user_id: toTechnicianId,
      title: 'Area Transfer Request',
      message: `${fromProfile?.name || 'A technician'} wants to transfer area "${area.area_name}" to you`,
      type: 'info',
      action_url: '/dashboard/technician',
    });

    return transfer;
  },

  async respondToTransfer(
    transferId: string,
    accept: boolean,
    actor: Actor,
    responseNote?: string,
  ): Promise<AreaTransferRequest> {
    const status = accept ? 'accepted' : 'rejected';
    const transfer = await areaTransfersDb.respond(transferId, status, responseNote);

    // If accepted, update area ownership
    if (accept) {
      await technicianAreasDb.update(transfer.area_id, {
        technician_id: actor.id,
      });
    }

    // Notify the requester
    await notificationsDb.create({
      user_id: transfer.from_technician_id,
      title: `Area Transfer ${accept ? 'Accepted' : 'Rejected'}`,
      message: accept
        ? 'Your area transfer request has been accepted'
        : `Your area transfer request was rejected${responseNote ? ': ' + responseNote : ''}`,
      type: accept ? 'success' : 'warning',
      action_url: '/dashboard/technician',
    });

    return transfer;
  },

  async getPendingTransfers(technicianId: string): Promise<AreaTransferRequest[]> {
    return areaTransfersDb.getPending(technicianId);
  },

  async getMyTransfers(technicianId: string): Promise<AreaTransferRequest[]> {
    return areaTransfersDb.getByTechnician(technicianId);
  },

  // ── Dashboard Data ─────────────────────────────────────────────────────
  async getTechnicianDashboard(technicianId: string) {
    const [myAreas, myIssues, openIssues, pendingTransfers] = await Promise.all([
      this.getMyAreas(technicianId),
      this.getMyIssues(technicianId),
      this.getAllOpenIssues(),
      this.getPendingTransfers(technicianId),
    ]);

    const areaIds = myAreas.map(a => a.id);
    const areaIssues = areaIds.length
      ? await serviceIssuesDb.getByAreas(areaIds)
      : [];

    return {
      myAreas,
      myIssues,
      areaIssues: areaIssues.filter(i => i.status !== 'completed'),
      openIssues: openIssues.filter(i => !i.assigned_to),
      pendingTransfers,
      stats: {
        totalAreas: myAreas.length,
        activeJobs: myIssues.length,
        areaIssuesCount: areaIssues.filter(i => i.status !== 'completed').length,
        openCount: openIssues.filter(i => !i.assigned_to).length,
        pendingTransferCount: pendingTransfers.length,
      },
    };
  },
};
