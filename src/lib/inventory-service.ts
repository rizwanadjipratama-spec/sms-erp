import { supabase } from './supabase';
import { logActivity } from './activity';
import { handleServiceError, logServiceExecution, withOperationLock } from './service-utils';
import type { DbRequest, InventoryLog, Product, RequestStatus, UserRole } from '@/types/types';

type InventoryActor = {
  id: string;
  email?: string;
  role: UserRole;
};

type WarehouseDashboardData = {
  requests: DbRequest[];
  products: Product[];
  inventoryLogs: InventoryLog[];
};

type InventoryAnalytics = {
  movementByMonth: Array<{
    month: string;
    inbound: number;
    outbound: number;
    net: number;
  }>;
  mostUsedProducts: Array<{
    productId: string;
    productName: string;
    qtyUsed: number;
  }>;
  stockValue: number;
};

const WAREHOUSE_REQUEST_STATUSES: RequestStatus[] = ['invoice_ready', 'preparing', 'ready'];
type StockAdjustmentReason = 'manual_adjustment' | 'returned_goods' | 'correction';

function assertStockMutator(role: UserRole) {
  if (!['warehouse', 'admin'].includes(role)) {
    throw new Error('Only warehouse or admin can mutate stock');
  }
}

async function fetchProductsByIds(productIds: string[]) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [] as Product[];

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('id', uniqueIds);

  if (error) throw new Error(error.message);
  return (data || []) as Product[];
}

async function hasPreparationLogs(orderId: string) {
  const { count, error } = await supabase
    .from('inventory_logs')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('reason', 'request_preparing');

  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

async function insertInventoryLog(log: Omit<InventoryLog, 'id' | 'created_at'>) {
  if (log.order_id) {
    const duplicateRes = await supabase
      .from('inventory_logs')
      .select('id')
      .eq('order_id', log.order_id)
      .eq('product_id', log.product_id)
      .eq('reason', log.reason)
      .eq('change', log.change)
      .maybeSingle();

    if (duplicateRes.error) throw new Error(duplicateRes.error.message);
    if (duplicateRes.data) return;
  }

  const { error } = await supabase.from('inventory_logs').insert({
    product_id: log.product_id,
    order_id: log.order_id || null,
    change: log.change,
    reason: log.reason,
    by_user: log.by_user || null,
  });

  if (error) throw new Error(error.message);
}

export const inventoryService = {
  async fetchWarehouseDashboardData(): Promise<WarehouseDashboardData> {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'inventory-service',
      action: 'fetchWarehouseDashboardData',
      stage: 'start',
      startedAt,
    });
    try {
      const [requestRes, productRes, logRes] = await Promise.all([
        supabase
          .from('requests')
          .select('*')
          .in('status', WAREHOUSE_REQUEST_STATUSES)
          .order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('category').order('name'),
        supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      if (requestRes.error) throw new Error(requestRes.error.message);
      if (productRes.error) throw new Error(productRes.error.message);
      if (logRes.error) throw new Error(logRes.error.message);

      await logServiceExecution({
        service: 'inventory-service',
        action: 'fetchWarehouseDashboardData',
        stage: 'success',
        startedAt,
        metadata: {
          requests: requestRes.data?.length || 0,
          products: productRes.data?.length || 0,
          inventoryLogs: logRes.data?.length || 0,
        },
      });

      return {
        requests: (requestRes.data || []) as DbRequest[],
        products: (productRes.data || []) as Product[],
        inventoryLogs: (logRes.data || []) as InventoryLog[],
      };
    } catch (error) {
      await logServiceExecution({
        service: 'inventory-service',
        action: 'fetchWarehouseDashboardData',
        stage: 'failure',
        startedAt,
      });
      throw handleServiceError('inventory-service', 'fetchWarehouseDashboardData', error);
    }
  },

  async consumeStockForPreparing(params: { request: DbRequest; actor: InventoryActor }) {
    return withOperationLock(`inventory:consume:${params.request.id}`, async () => {
      const { request, actor } = params;
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'inventory-service',
        action: 'consumeStockForPreparing',
        stage: 'start',
        startedAt,
        metadata: {
          requestId: request.id,
          actorId: actor.id,
        },
      });
      try {
        assertStockMutator(actor.role);

        if (request.status !== 'preparing') {
          throw new Error('Stock can only be consumed after request enters preparing');
        }

        if (await hasPreparationLogs(request.id)) {
          await logServiceExecution({
            service: 'inventory-service',
            action: 'consumeStockForPreparing',
            stage: 'success',
            startedAt,
            metadata: {
              requestId: request.id,
              actorId: actor.id,
              skipped: 'already_prepared',
            },
          });
          return;
        }

        const products = await fetchProductsByIds(request.items.map((item) => item.id));
        const productMap = products.reduce<Record<string, Product>>((acc, product) => {
          acc[product.id] = product;
          return acc;
        }, {});

        for (const item of request.items) {
          const product = productMap[item.id];
          if (!product) {
            throw new Error(`Product ${item.id} not found`);
          }
          if (product.stock < item.qty) {
            throw new Error(`Insufficient stock for ${product.name}. Available ${product.stock}, requested ${item.qty}`);
          }
        }

        for (const item of request.items) {
          const { error: rpcError } = await supabase.rpc('decrement_stock', {
            p_product_id: item.id,
            p_qty: item.qty,
          });

          if (rpcError) throw new Error(rpcError.message);

          await insertInventoryLog({
            product_id: item.id,
            order_id: request.id,
            change: -item.qty,
            reason: 'request_preparing',
            by_user: actor.email || actor.id,
          });

          await logActivity(
            actor.id,
            'inventory_consumed',
            'inventory',
            item.id,
            {
              order_id: request.id,
              product_id: item.id,
              quantity: item.qty,
              reason: 'request_preparing',
            },
            actor.email
          );
        }
        await logServiceExecution({
          service: 'inventory-service',
          action: 'consumeStockForPreparing',
          stage: 'success',
          startedAt,
          metadata: {
            requestId: request.id,
            actorId: actor.id,
            itemCount: request.items.length,
          },
        });
      } catch (error) {
        await logServiceExecution({
          service: 'inventory-service',
          action: 'consumeStockForPreparing',
          stage: 'failure',
          startedAt,
          metadata: {
            requestId: params.request.id,
            actorId: params.actor.id,
          },
        });
        throw handleServiceError('inventory-service', 'consumeStockForPreparing', error, {
          requestId: params.request.id,
          actorId: params.actor.id,
        });
      }
    });
  },

  async adjustStock(params: {
    product: Product;
    nextStock: number;
    actor: InventoryActor;
    reason: StockAdjustmentReason;
  }) {
    return withOperationLock(`inventory:adjust:${params.product.id}`, async () => {
      const { product, nextStock, actor, reason } = params;
      const startedAt = Date.now();
      await logServiceExecution({
        service: 'inventory-service',
        action: 'adjustStock',
        stage: 'start',
        startedAt,
        metadata: {
          productId: product.id,
          actorId: actor.id,
          nextStock,
          reason,
        },
      });
      try {
        assertStockMutator(actor.role);

        if (nextStock < 0) {
          throw new Error('Stock cannot be negative');
        }

        const change = nextStock - product.stock;
        if (change === 0) {
          await logServiceExecution({
            service: 'inventory-service',
            action: 'adjustStock',
            stage: 'success',
            startedAt,
            metadata: {
              productId: product.id,
              actorId: actor.id,
              skipped: 'no_change',
            },
          });
          return;
        }

        const { error } = await supabase
          .from('products')
          .update({
            stock: nextStock,
            status: nextStock > 0 ? 'in_stock' : 'out_of_stock',
          })
          .eq('id', product.id)
          .eq('stock', product.stock);

        if (error) throw new Error(error.message);

        await insertInventoryLog({
          product_id: product.id,
          order_id: undefined,
          change,
          reason,
          by_user: actor.email || actor.id,
        });

        await logActivity(
          actor.id,
          'inventory_adjusted',
          'inventory',
          product.id,
          {
            product_id: product.id,
            previous_stock: product.stock,
            next_stock: nextStock,
            change,
            reason,
          },
          actor.email
        );
        await logServiceExecution({
          service: 'inventory-service',
          action: 'adjustStock',
          stage: 'success',
          startedAt,
          metadata: {
            productId: product.id,
            actorId: actor.id,
            change,
          },
        });
      } catch (error) {
        await logServiceExecution({
          service: 'inventory-service',
          action: 'adjustStock',
          stage: 'failure',
          startedAt,
          metadata: {
            productId: params.product.id,
            actorId: params.actor.id,
          },
        });
        throw handleServiceError('inventory-service', 'adjustStock', error, {
          productId: params.product.id,
          actorId: params.actor.id,
        });
      }
    });
  },

  async fetchInventoryHistory(limit = 50) {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'inventory-service',
      action: 'fetchInventoryHistory',
      stage: 'start',
      startedAt,
      metadata: { limit },
    });
    try {
      const { data, error } = await supabase
        .from('inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      await logServiceExecution({
        service: 'inventory-service',
        action: 'fetchInventoryHistory',
        stage: 'success',
        startedAt,
        metadata: {
          limit,
          rows: data?.length || 0,
        },
      });
      return (data || []) as InventoryLog[];
    } catch (error) {
      await logServiceExecution({
        service: 'inventory-service',
        action: 'fetchInventoryHistory',
        stage: 'failure',
        startedAt,
        metadata: { limit },
      });
      throw handleServiceError('inventory-service', 'fetchInventoryHistory', error, { limit });
    }
  },

  async getInventoryAnalytics(): Promise<InventoryAnalytics> {
    const startedAt = Date.now();
    await logServiceExecution({
      service: 'inventory-service',
      action: 'getInventoryAnalytics',
      stage: 'start',
      startedAt,
    });
    try {
      const since = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString();
      const [logsRes, productsRes, pricesRes] = await Promise.all([
        supabase.from('inventory_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('price_list').select('product_id, price_regular'),
      ]);

      if (logsRes.error) throw new Error(logsRes.error.message);
      if (productsRes.error) throw new Error(productsRes.error.message);
      if (pricesRes.error) throw new Error(pricesRes.error.message);

      const logs = (logsRes.data || []) as InventoryLog[];
      const products = (productsRes.data || []) as Product[];
      const priceRows = (pricesRes.data || []) as Array<{ product_id: string; price_regular: number }>;
      const priceMap = priceRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.product_id] = row.price_regular;
        return acc;
      }, {});

      const movementMap = logs.reduce<Record<string, { inbound: number; outbound: number; net: number }>>(
        (acc, log) => {
          const month = new Date(log.created_at).toISOString().slice(0, 7);
          const bucket = acc[month] || { inbound: 0, outbound: 0, net: 0 };
          if (log.change > 0) bucket.inbound += log.change;
          if (log.change < 0) bucket.outbound += Math.abs(log.change);
          bucket.net += log.change;
          acc[month] = bucket;
          return acc;
        },
        {}
      );

      const usageMap = logs.reduce<Record<string, number>>((acc, log) => {
        if (log.change < 0) {
          acc[log.product_id] = (acc[log.product_id] || 0) + Math.abs(log.change);
        }
        return acc;
      }, {});

      const productMap = products.reduce<Record<string, Product>>((acc, product) => {
        acc[product.id] = product;
        return acc;
      }, {});

      const stockValue = products.reduce((sum, product) => {
        const referencePrice = priceMap[product.id] || 0;
        return sum + product.stock * referencePrice;
      }, 0);

      const result = {
        movementByMonth: Object.entries(movementMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, value]) => ({
            month,
            inbound: value.inbound,
            outbound: value.outbound,
            net: value.net,
          })),
        mostUsedProducts: Object.entries(usageMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([productId, qtyUsed]) => ({
            productId,
            productName: productMap[productId]?.name || productId,
            qtyUsed,
          })),
        stockValue,
      };
      await logServiceExecution({
        service: 'inventory-service',
        action: 'getInventoryAnalytics',
        stage: 'success',
        startedAt,
        metadata: {
          movementBuckets: result.movementByMonth.length,
          productsTracked: result.mostUsedProducts.length,
        },
      });
      return result;
    } catch (error) {
      await logServiceExecution({
        service: 'inventory-service',
        action: 'getInventoryAnalytics',
        stage: 'failure',
        startedAt,
      });
      throw handleServiceError('inventory-service', 'getInventoryAnalytics', error);
    }
  },
};
