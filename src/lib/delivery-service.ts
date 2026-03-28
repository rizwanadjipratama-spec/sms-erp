import { logActivity } from './activity';
import { handleServiceError, logServiceExecution, withOperationLock } from './service-utils';
import { supabase } from './supabase';
import { workflowEngine } from './workflow-engine';
import type { DbRequest, DeliveryLog, UserRole } from '@/types/types';

const PROOF_BUCKET = 'delivery-proofs';

type DeliveryActor = {
  id: string;
  email?: string;
  role: UserRole;
};

type TechnicianDashboardData = {
  requests: DbRequest[];
  deliveryLogs: DeliveryLog[];
};

type DeliveryAnalytics = {
  deliveriesPerTechnician: Array<{
    technicianId: string;
    deliveries: number;
  }>;
  averageDeliveryHours: number;
  deliveriesPerMonth: Array<{
    month: string;
    deliveries: number;
  }>;
};

function assertTechnician(role: UserRole) {
  if (role !== 'technician') {
    throw new Error('Only technician can perform delivery actions');
  }
}

function ensureAssignedTechnician(request: DbRequest, actorId: string) {
  if (request.assigned_technician_id && request.assigned_technician_id !== actorId) {
    throw new Error('This delivery is assigned to another technician');
  }
}

export const deliveryService = {
  async fetchTechnicianDashboardData(actor: DeliveryActor): Promise<TechnicianDashboardData> {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'delivery-service',
      action: 'fetchTechnicianDashboardData',
      stage: 'start',
      startedAt,
      metadata: { actorId: actor.id },
    });
    try {
      assertTechnician(actor.role);

      const [requestRes, logRes] = await Promise.all([
        supabase
          .from('requests')
          .select('*, request_items(*, products(name))')
          .in('status', ['ready', 'on_delivery', 'delivered'])
          .order('created_at', { ascending: false }),
        supabase
          .from('delivery_logs')
          .select('*')
          .eq('technician_id', actor.id)
          .order('delivered_at', { ascending: false })
          .limit(20),
      ]);

      if (requestRes.error) throw new Error(requestRes.error.message);
      if (logRes.error) throw new Error(logRes.error.message);

      await logServiceExecution({
        service: 'delivery-service',
        action: 'fetchTechnicianDashboardData',
        stage: 'success',
        startedAt,
        metadata: {
          actorId: actor.id,
          requests: requestRes.data?.length || 0,
          logs: logRes.data?.length || 0,
        },
      });

      return {
        requests: ((requestRes.data || []) as DbRequest[]).filter(
          (request) => request.status === 'ready' || request.assigned_technician_id === actor.id
        ),
        deliveryLogs: (logRes.data || []) as DeliveryLog[],
      };
    } catch (error) {
      await logServiceExecution({
        service: 'delivery-service',
        action: 'fetchTechnicianDashboardData',
        stage: 'failure',
        startedAt,
        metadata: { actorId: actor.id },
      });
      throw handleServiceError('delivery-service', 'fetchTechnicianDashboardData', error, {
        actorId: actor.id,
      });
    }
  },

  async uploadProof(params: { requestId: string; actorId: string; file: File }) {
    return withOperationLock(`delivery:upload-proof:${params.actorId}:${params.requestId}:${params.file.name}`, async () => {
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'delivery-service',
        action: 'uploadProof',
        stage: 'start',
        startedAt,
        metadata: {
          requestId: params.requestId,
          actorId: params.actorId,
          fileName: params.file.name,
        },
      });
      try {
        const { requestId, actorId, file } = params;
        const filePath = `${actorId}/${requestId}-${file.name.replace(/\s+/g, '-')}`;
        const { error } = await supabase.storage.from(PROOF_BUCKET).upload(filePath, file, {
          upsert: true,
        });

        if (error) throw new Error(error.message);

        const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(filePath);
        await logServiceExecution({
          service: 'delivery-service',
          action: 'uploadProof',
          stage: 'success',
          startedAt,
          metadata: {
            requestId,
            actorId,
            filePath,
          },
        });
        return data.publicUrl;
      } catch (error) {
        await logServiceExecution({
          service: 'delivery-service',
          action: 'uploadProof',
          stage: 'failure',
          startedAt,
          metadata: {
            requestId: params.requestId,
            actorId: params.actorId,
          },
        });
        throw handleServiceError('delivery-service', 'uploadProof', error, {
          requestId: params.requestId,
          actorId: params.actorId,
        });
      }
    });
  },

  async startDelivery(params: { request: DbRequest; actor: DeliveryActor }) {
    return withOperationLock(`delivery:start:${params.request.id}`, async () => {
      const { request, actor } = params;
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'delivery-service',
        action: 'startDelivery',
        stage: 'start',
        startedAt,
        metadata: {
          requestId: request.id,
          actorId: actor.id,
        },
      });
      try {
        assertTechnician(actor.role);

        if (request.status === 'on_delivery' && request.assigned_technician_id === actor.id) {
          await logServiceExecution({
            service: 'delivery-service',
            action: 'startDelivery',
            stage: 'success',
            startedAt,
            metadata: {
              requestId: request.id,
              actorId: actor.id,
              skipped: 'already_started',
            },
          });
          return request;
        }

        if (request.status !== 'ready') {
          throw new Error('Only ready orders can be picked up');
        }

        ensureAssignedTechnician(request, actor.id);

        await logActivity(
          actor.id,
          'delivery_claimed',
          'delivery',
          request.id,
          {
            technician_id: actor.id,
            previous_status: request.status,
          },
          actor.email
        );

        const updatedRequest = await workflowEngine.transitionOrder({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: 'on_delivery',
          action: 'delivery_start',
          message: `Technician started delivery for request ${request.id}`,
          type: 'info',
          notifyRoles: ['admin', 'owner'],
          extraUpdates: {
            assigned_technician_id: actor.id,
          },
          metadata: {
            technician_id: actor.id,
          },
        });
        await logServiceExecution({
          service: 'delivery-service',
          action: 'startDelivery',
          stage: 'success',
          startedAt,
          metadata: {
            requestId: request.id,
            actorId: actor.id,
          },
        });
        return updatedRequest;
      } catch (error) {
        await logServiceExecution({
          service: 'delivery-service',
          action: 'startDelivery',
          stage: 'failure',
          startedAt,
          metadata: {
            requestId: params.request.id,
            actorId: params.actor.id,
          },
        });
        throw handleServiceError('delivery-service', 'startDelivery', error, {
          requestId: params.request.id,
          actorId: params.actor.id,
        });
      }
    });
  },

  async completeDelivery(params: {
    request: DbRequest;
    actor: DeliveryActor;
    proofUrl?: string | null;
    signatureUrl?: string | null;
    note?: string | null;
  }) {
    return withOperationLock(`delivery:complete:${params.request.id}`, async () => {
      const { request, actor, proofUrl, signatureUrl, note } = params;
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'delivery-service',
        action: 'completeDelivery',
        stage: 'start',
        startedAt,
        metadata: {
          requestId: request.id,
          actorId: actor.id,
        },
      });
      try {
        assertTechnician(actor.role);

        const existingLogRes = await supabase
          .from('delivery_logs')
          .select('*')
          .eq('order_id', request.id)
          .maybeSingle();

        if (existingLogRes.error) throw new Error(existingLogRes.error.message);
        if (existingLogRes.data) {
          await logServiceExecution({
            service: 'delivery-service',
            action: 'completeDelivery',
            stage: 'success',
            startedAt,
            metadata: {
              requestId: request.id,
              actorId: actor.id,
              deliveryLogId: existingLogRes.data.id,
              reused: true,
            },
          });
          return existingLogRes.data as DeliveryLog;
        }

        if (request.status !== 'on_delivery') {
          throw new Error('Only active deliveries can be completed');
        }

        if (request.assigned_technician_id !== actor.id) {
          throw new Error('Only the assigned technician can complete this delivery');
        }

        const deliveredAt = new Date().toISOString();
        const { data, error } = await supabase
          .from('delivery_logs')
          .insert({
            order_id: request.id,
            technician_id: actor.id,
            proof_url: proofUrl || null,
            signature_url: signatureUrl || null,
            note: note || null,
            delivered_at: deliveredAt,
          })
          .select('*')
          .single();

        if (error) {
          const duplicateLogRes = await supabase
            .from('delivery_logs')
            .select('*')
            .eq('order_id', request.id)
            .maybeSingle();
          if (duplicateLogRes.data) {
            await logServiceExecution({
              service: 'delivery-service',
              action: 'completeDelivery',
              stage: 'success',
              startedAt,
              metadata: {
                requestId: request.id,
                actorId: actor.id,
                deliveryLogId: duplicateLogRes.data.id,
                reused: true,
              },
            });
            return duplicateLogRes.data as DeliveryLog;
          }
          throw new Error(error.message);
        }

        const deliveryLog = data as DeliveryLog;

        await logActivity(
          actor.id,
          'delivery_log_created',
          'delivery_log',
          deliveryLog.id,
          {
            order_id: request.id,
            technician_id: actor.id,
            proof_url: proofUrl || null,
            delivered_at: deliveredAt,
          },
          actor.email
        );

        await workflowEngine.transitionOrder({
          request,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          nextStatus: 'delivered',
          action: 'delivery',
          message: `Order ${request.id} has been delivered`,
          type: 'success',
          notifyRoles: ['admin', 'owner'],
          metadata: {
            technician_id: actor.id,
            delivery_log_id: deliveryLog.id,
            proof_url: proofUrl || null,
          },
        });

        await logServiceExecution({
          service: 'delivery-service',
          action: 'completeDelivery',
          stage: 'success',
          startedAt,
          metadata: {
            requestId: request.id,
            actorId: actor.id,
            deliveryLogId: deliveryLog.id,
          },
        });

        return deliveryLog;
      } catch (error) {
        await logServiceExecution({
          service: 'delivery-service',
          action: 'completeDelivery',
          stage: 'failure',
          startedAt,
          metadata: {
            requestId: params.request.id,
            actorId: params.actor.id,
          },
        });
        throw handleServiceError('delivery-service', 'completeDelivery', error, {
          requestId: params.request.id,
          actorId: params.actor.id,
        });
      }
    });
  },

  async getDeliveryAnalytics(): Promise<DeliveryAnalytics> {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'delivery-service',
      action: 'getDeliveryAnalytics',
      stage: 'start',
      startedAt,
    });
    try {
      const since = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString();
      const [logRes, requestRes] = await Promise.all([
        supabase.from('delivery_logs').select('technician_id, delivered_at').gte('delivered_at', since).order('delivered_at', { ascending: false }),
        supabase
          .from('requests')
          .select('assigned_technician_id, on_delivery_at, delivered_at, status')
          .eq('status', 'delivered')
          .gte('created_at', since),
      ]);

      if (logRes.error) throw new Error(logRes.error.message);
      if (requestRes.error) throw new Error(requestRes.error.message);

      const logs = (logRes.data || []) as Array<{ technician_id: string; delivered_at?: string }>;
      const requests = (requestRes.data || []) as Array<{
        assigned_technician_id?: string;
        on_delivery_at?: string;
        delivered_at?: string;
        status: string;
      }>;

      const deliveriesPerTechnicianMap = logs.reduce<Record<string, number>>((acc, log) => {
        acc[log.technician_id] = (acc[log.technician_id] || 0) + 1;
        return acc;
      }, {});

      const durations = requests
        .filter((request) => request.assigned_technician_id && request.on_delivery_at && request.delivered_at)
        .map((request) => {
          const start = new Date(request.on_delivery_at as string).getTime();
          const end = new Date(request.delivered_at as string).getTime();
          return Math.max(0, (end - start) / 36e5);
        });

      const deliveriesPerMonthMap = logs.reduce<Record<string, number>>((acc, log) => {
        const sourceDate = log.delivered_at || new Date().toISOString();
        const month = new Date(sourceDate).toISOString().slice(0, 7);
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

      const result = {
        deliveriesPerTechnician: Object.entries(deliveriesPerTechnicianMap)
          .sort((a, b) => b[1] - a[1])
          .map(([technicianId, deliveries]) => ({
            technicianId,
            deliveries,
          })),
        averageDeliveryHours:
          durations.length > 0
            ? Number((durations.reduce((sum, hours) => sum + hours, 0) / durations.length).toFixed(2))
            : 0,
        deliveriesPerMonth: Object.entries(deliveriesPerMonthMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, deliveries]) => ({
            month,
            deliveries,
          })),
      };
      await logServiceExecution({
        service: 'delivery-service',
        action: 'getDeliveryAnalytics',
        stage: 'success',
        startedAt,
        metadata: {
          technicians: result.deliveriesPerTechnician.length,
          months: result.deliveriesPerMonth.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'delivery-service',
        action: 'getDeliveryAnalytics',
        stage: 'failure',
        startedAt,
      });
      throw handleServiceError('delivery-service', 'getDeliveryAnalytics', error);
    }
  },
};
