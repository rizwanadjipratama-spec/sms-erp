import { supabase } from '@/lib/supabase';
import type { 
  CompanyRequest, 
  CompanyRequestItem, 
  CompanyRequestHistory,
  Actor,
  PaymentPreferenceType,
  CompanyRequestType,
  CompanyRequestStatus
} from '@/types/types';

export const claimService = {
  // CREATE Request (Type CLAIM or REQUISITION)
  async createRequest(
    data: {
      type: CompanyRequestType;
      branch_id: string;
      payment_preference: PaymentPreferenceType;
      payment_preference_details?: string;
      items: Omit<CompanyRequestItem, 'id' | 'request_id' | 'created_at'>[];
    },
    actor: Actor
  ): Promise<string> {
    // Basic validations
    if (!data.items || data.items.length === 0) {
      throw new Error('A request must have at least one item');
    }
    if (data.type === 'CLAIM') {
        const missingReceipt = data.items.some(i => !i.receipt_url);
        if (missingReceipt) {
            throw new Error('All items in a Reimbursement Claim must have receipt photos.');
        }
    }

    const total_amount = data.items.reduce((sum, item) => sum + item.total_price, 0);

    // 1. Insert header
    const { data: request, error: reqError } = await supabase
      .from('company_requests')
      .insert({
        created_by: actor.id,
        branch_id: data.branch_id,
        type: data.type,
        status: 'SUBMITTED',
        payment_preference: data.payment_preference,
        total_amount,
        paid_amount: 0
      } as any)
      .select('id')
      .single();

    if (reqError) throw new Error(`Create Request failed: ${reqError.message}`);

    const requestId = request.id;

    // 2. Insert items
    const itemsToInsert = data.items.map(item => ({
      ...item,
      request_id: requestId
    }));

    const { error: itemsError } = await supabase
      .from('company_request_items')
      .insert(itemsToInsert as any);

    if (itemsError) throw new Error(`Add items failed: ${itemsError.message}`);

    // 3. Audit History
    await supabase.from('company_request_history').insert({
      request_id: requestId,
      actor_id: actor.id,
      action: 'CREATED',
      note: `Requested ${data.type} for ${total_amount.toLocaleString()}`
    } as any);

    return requestId;
  },

  // GET Requests with nested Items and Creator profiles
  async getRequests(filters?: { 
      status?: CompanyRequestStatus | CompanyRequestStatus[]; 
      branch_id?: string;
      created_by?: string;
  }): Promise<CompanyRequest[]> {
    let query = supabase
      .from('company_requests')
      .select(`
        *,
        creator:profiles!company_requests_creator_profile_fkey(name, email, avatar_url, role),
        approver:profiles!company_requests_approver_profile_fkey(name, email, avatar_url, role),
        branch:branches(name),
        items:company_request_items(*),
        history:company_request_history(*, actor:profiles!company_request_history_actor_profile_fkey(name, role, avatar_url))
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }
    if (filters?.branch_id && filters.branch_id !== 'ALL') query = query.eq('branch_id', filters.branch_id);
    if (filters?.created_by) query = query.eq('created_by', filters.created_by);

    const { data, error } = await query;
    if (error) throw new Error(`Get Requests failed: ${error.message}`);
    return data as CompanyRequest[];
  },

  // APPROVER LOGIC: Approve
  async approveRequest(id: string, note: string | undefined, actor: Actor): Promise<void> {
    if (!['owner', 'director', 'admin', 'claim_officer'].includes(actor.role)) {
      throw new Error('Unauthorized to approve claims');
    }

    const { error } = await supabase
      .from('company_requests')
      .update({
        status: 'APPROVED',
        approved_by: actor.id,
        approval_date: new Date().toISOString(),
        approval_note: note
      } as any)
      .eq('id', id)
      .eq('status', 'SUBMITTED');

    if (error) throw new Error(`Approve failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: 'APPROVED',
      note: note || 'Approved by Executive'
    } as any);
  },

  // APPROVER LOGIC: Reject
  async rejectRequest(id: string, reason: string, actor: Actor): Promise<void> {
    if (!reason.trim()) throw new Error('Reject reason is required');

    const { error } = await supabase
      .from('company_requests')
      .update({
        status: 'REJECTED',
        reject_reason: reason
      } as any)
      .eq('id', id);

    if (error) throw new Error(`Reject failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: 'REJECTED',
      note: reason
    } as any);
  },

  // OFFICER LOGIC: Process disbursement (Partial, Negotiation, Full)
  async processDisbursement(
    id: string,
    currentRequest: CompanyRequest,
    actionData: {
      pay_amount: number;
      payment_method_used: PaymentPreferenceType;
      pending_reason?: string; // mandatory if pay_amount < total OR using different method
    },
    actor: Actor
  ): Promise<void> {
    const { pay_amount, payment_method_used, pending_reason } = actionData;
    const previousPaid = currentRequest.paid_amount || 0;
    const newPaidAmount = previousPaid + pay_amount;
    const balance = currentRequest.total_amount - newPaidAmount;

    let newStatus: CompanyRequestStatus = 'PENDING';
    let historyAction = 'FUNDS_PROCESSED';

    // Conflict Check
    const methodConflict = payment_method_used !== currentRequest.payment_preference;
    
    if (balance > 0) {
      newStatus = 'PENDING';
      historyAction = 'PARTIAL_PAYMENT';
    } else {
      // Full Payment
      if (methodConflict) {
        // Need user negotiation
        newStatus = 'PENDING';
        historyAction = 'PAYMENT_NEGOTIATION';
      } else if (payment_method_used === 'CASH') {
        newStatus = 'READY_FOR_CASH';
        historyAction = 'CASH_READY';
      } else if (payment_method_used === 'TRANSFER') {
        newStatus = 'PENDING'; // Still needs to perform the transfer
        historyAction = 'QUEUEING_TRANSFER';
      }
    }

    const { error } = await supabase
      .from('company_requests')
      .update({
        status: newStatus,
        paid_amount: newPaidAmount,
        payment_method_offered: methodConflict ? payment_method_used : null,
        pending_reason: pending_reason || (balance > 0 ? `Waiting to pay remaining ${balance}` : null)
      } as any)
      .eq('id', id);

    if (error) throw new Error(`Disbursement failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: historyAction,
      note: `Amount: ${pay_amount}. Method: ${payment_method_used}. ${pending_reason ? '(' + pending_reason + ')' : ''}`
    } as any);
  },

  // OFFICER LOGIC: Mark Transfer Done
  async markTransferDone(id: string, actor: Actor): Promise<void> {
    const { error } = await supabase
      .from('company_requests')
      .update({
        status: 'COMPLETED',
        pending_reason: null
      } as any)
      .eq('id', id);

    if (error) throw new Error(`Mark Transfer Done failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: 'TRANSFER_COMPLETED',
      note: 'Transfer has been successfully sent to the employee.'
    } as any);
  },

  // EMPLOYEE/OFFICER LOGIC: Accept Negotiation or Ready Cash (Complete Claim)
  async completeClaim(id: string, actor: Actor): Promise<void> {
    const { error } = await supabase
      .from('company_requests')
      .update({
        status: 'COMPLETED',
        pending_reason: null
      } as any)
      .eq('id', id);

    if (error) throw new Error(`Complete Claim failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: 'CLAIMED',
      note: 'Employee has successfully received the funds and claim is closed.'
    } as any);
  },

  // EMPLOYEE LOGIC: Reject Negotiation
  async rejectNegotiation(id: string, reason: string, actor: Actor): Promise<void> {
    const { error } = await supabase
      .from('company_requests')
      .update({
        status: 'PENDING',
        pending_reason: `Employee rejected payment method: ${reason}`
      } as any)
      .eq('id', id);

    if (error) throw new Error(`Reject Negotiation failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: 'NEGOTIATION_REJECTED',
      note: reason
    } as any);
  },

  // OFFICER LOGIC: Flag Post-Claim Issue
  async flagPostClaimIssue(id: string, issueNote: string, actor: Actor): Promise<void> {
    const { error } = await supabase
      .from('company_requests')
      .update({
        post_claim_issue: issueNote
      } as any)
      .eq('id', id)
      .eq('status', 'COMPLETED');

    if (error) throw new Error(`Flag Issue failed: ${error.message}`);

    await supabase.from('company_request_history').insert({
      request_id: id,
      actor_id: actor.id,
      action: 'ISSUE_FLAGGED',
      note: issueNote
    } as any);
  }
};
