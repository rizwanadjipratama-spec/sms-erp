import { supabase } from '@/lib/supabase';
import type { LeaveRequest, Profile } from '@/types/types';

export const leaveService = {
  /**
   * Submit a new leave request.
   * If an attachment is provided, it uploads to 'leave-attachments' bucket.
   */
  async submitLeave(
    userId: string,
    data: {
      type: LeaveRequest['type'];
      start_date: string;
      end_date: string;
      days_count: number;
      reason: string;
    },
    file?: File
  ): Promise<LeaveRequest> {
    let attachment_url = null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `leaves/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('leave-attachments')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Failed to upload attachment: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('leave-attachments')
        .getPublicUrl(filePath);

      attachment_url = publicUrlData.publicUrl;
    }

    const { data: request, error } = await supabase
      .from('leave_requests')
      .insert([
        {
          user_id: userId,
          type: data.type,
          start_date: data.start_date,
          end_date: data.end_date,
          days_count: data.days_count,
          reason: data.reason,
          attachment_url,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to submit leave: ${error.message}`);
    return request;
  },

  /**
   * Get all leaves for a specific user
   */
  async getMyLeaves(userId: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        reviewer:reviewed_by (id, email, name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch leaves: ${error.message}`);
    return data as any as LeaveRequest[];
  },

  /**
   * Get all leaves, primarily for supervisors
   */
  async getAllLeaves(): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        profiles:user_id (id, email, name, avatar_url, role),
        reviewer:reviewed_by (id, email, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch all leaves: ${error.message}`);
    return data as any as LeaveRequest[];
  },

  /**
   * Get leaves currently active today or in the future that are approved
   */
  async getActiveStatusBoard(): Promise<LeaveRequest[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        profiles:user_id (id, email, name, avatar_url, role)
      `)
      .eq('status', 'approved')
      .gte('end_date', today)
      .order('start_date', { ascending: true });

    if (error) throw new Error(`Failed to fetch status board: ${error.message}`);
    return data as any as LeaveRequest[];
  },

  /**
   * Approve a leave request and deduct quota if it's annual leave
   */
  async approveLeave(
    leaveId: string,
    reviewerId: string,
    userId: string,
    type: LeaveRequest['type'],
    daysCount: number
  ): Promise<void> {
    // 1. Mark as approved
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', leaveId);

    if (updateError) throw new Error(`Failed to approve leave: ${updateError.message}`);

    // 2. If 'annual', decrement quota via profiles
    // Doing a raw update. The schema constraint normally dictates atomic operations.
    // For simplicity, we fetch, calculate, then update.
    if (type === 'annual') {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('leave_balance')
        .eq('id', userId)
        .single();
        
      if (profileErr) throw new Error(`Could not fetch profile balance: ${profileErr.message}`);

      const newBalance = Math.max(0, (profile?.leave_balance || 0) - daysCount);

      const { error: deductionErr } = await supabase
        .from('profiles')
        .update({ leave_balance: newBalance })
        .eq('id', userId);

      if (deductionErr) throw new Error(`Failed to deduct quota: ${deductionErr.message}`);
    }
  },

  /**
   * Reject a leave request with a mandatory reason
   */
  async rejectLeave(
    leaveId: string,
    reviewerId: string,
    rejectionReason: string
  ): Promise<void> {
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', leaveId);

    if (error) throw new Error(`Failed to reject leave: ${error.message}`);
  },

  /**
   * Update a user's total leave balance (Supervisor only)
   */
  async updateUserLeaveBalance(userId: string, newBalance: number): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ leave_balance: newBalance })
      .eq('id', userId);

    if (error) throw new Error(`Failed to update leave balance: ${error.message}`);
  }
};
