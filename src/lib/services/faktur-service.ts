import { fakturTasksDb } from '../db';
import type { FakturTask, FakturTaskStatus, FakturTaskType, Actor } from '@/types/types';

export const fakturService = {
  /**
   * Assign a new task for a Faktur staff member (usually done by Finance)
   */
  async assignTask(
    clientId: string,
    taskType: FakturTaskType,
    assigneeId: string | null,
    notes: string | undefined,
    creator: Actor
  ): Promise<FakturTask> {
    if (!['finance', 'boss', 'director', 'admin', 'owner'].includes(creator.role)) {
      throw new Error('Unauthorized to assign faktur tasks');
    }

    return fakturTasksDb.create({
      client_id: clientId,
      task_type: taskType,
      assigned_to: assigneeId || undefined,
      notes,
      created_by: creator.id,
      status: 'pending',
    });
  },

  /**
   * Fetch tasks meant for a specific Faktur staff member (or unassigned)
   */
  async getMyUpcomingTasks(assigneeId: string): Promise<FakturTask[]> {
    return fakturTasksDb.getUpcoming(assigneeId);
  },

  /**
   * Let a Faktur staff member update the task scheduling / taking ownership
   */
  async updateTaskSchedule(
    taskId: string,
    scheduledDate: string,
    actor: Actor
  ): Promise<FakturTask> {
    if (!['faktur', 'finance', 'boss', 'admin', 'owner'].includes(actor.role)) {
      throw new Error('Unauthorized to reschedule faktur tasks');
    }

    const task = await fakturTasksDb.getById(taskId);
    if (!task) throw new Error('Task not found');
    
    // Auto-claim the task if unassigned and it's a Faktur user doing it
    let assigned_to = task.assigned_to;
    if (actor.role === 'faktur' && !assigned_to) {
      assigned_to = actor.id;
    }

    return fakturTasksDb.update(taskId, {
      scheduled_date: scheduledDate,
      status: 'scheduled',
      assigned_to,
    });
  },

  /**
   * Mark a Faktur task as complete
   */
  async completeTask(
    taskId: string,
    completionNote: string,
    actor: Actor
  ): Promise<FakturTask> {
    if (!['faktur', 'finance', 'boss', 'admin', 'owner'].includes(actor.role)) {
      throw new Error('Unauthorized to complete faktur tasks');
    }

    if (!completionNote?.trim()) {
      throw new Error('Completion note is required');
    }

    return fakturTasksDb.update(taskId, {
      status: 'completed',
      completion_note: completionNote,
    });
  },

  /**
   * General pool fetched by Finance Dashboard
   */
  async getAllTasks(): Promise<FakturTask[]> {
    return fakturTasksDb.getAll();
  }
};
