// ============================================================================
// INVENTORY SERVICE — Stock management and warehouse operations
// ============================================================================

import { productsDb, requestsDb, inventoryLogsDb, activityLogsDb, systemLogsDb } from '@/lib/db';
import type { Actor, DbRequest, InventoryLog, Product, PaginationParams, InventoryMovementType } from '@/types/types';

export const inventoryService = {
  async getWarehouseDashboard(branchId?: string) {
    const [productsResult, warehouseRequests, recentLogs] = await Promise.all([
      productsDb.getAll({ onlyActive: true, branchId }),
      requestsDb.getByStatus(['invoice_ready', 'preparing', 'ready'], undefined, branchId),
      inventoryLogsDb.getRecent(30, branchId),
    ]);

    return {
      products: productsResult.data,
      requests: warehouseRequests.data,
      recentLogs,
    };
  },

  async consumeStockForPreparing(request: DbRequest, actor: Actor): Promise<void> {
    if (!request.request_items?.length) {
      const full = await requestsDb.getById(request.id);
      if (!full?.request_items?.length) {
        throw new Error('No items found for this request');
      }
      request = full;
    }

    // Decrement stock for all items concurrently (each RPC uses SELECT FOR UPDATE internally)
    const balances = await Promise.all(
      request.request_items!.map(item =>
        productsDb.decrementStock(item.product_id, item.quantity)
      )
    );

    // Batch-insert all inventory logs in a single query
    const logs = request.request_items!.map((item, idx) => ({
      product_id: item.product_id,
      order_id: request.id,
      change: -item.quantity,
      balance: balances[idx],
      movement_type: 'SALES_OUT' as const,
      reason: `Stock consumed for order ${request.id}`,
      created_by: actor.id,
    }));
    await inventoryLogsDb.createMany(logs);

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: 'consume_stock',
      entity_type: 'request',
      entity_id: request.id,
      metadata: {
        items_count: request.request_items!.length,
      },
    });
  },

  async adjustStock(productId: string, change: number, reason: string, actor: Actor, movementType: InventoryMovementType = 'ADJUSTMENT'): Promise<Product> {
    const product = await productsDb.getById(productId);
    if (!product) throw new Error('Product not found');

    const newStock = product.stock + change;
    if (newStock < 0) throw new Error('Stock cannot go below zero');

    let newBalance: number;
    if (change > 0) {
      newBalance = await productsDb.incrementStock(productId, change);
    } else {
      newBalance = await productsDb.decrementStock(productId, Math.abs(change));
    }

    await inventoryLogsDb.create({
      product_id: productId,
      change,
      balance: newBalance,
      movement_type: movementType,
      reason,
      created_by: actor.id,
    });

    await activityLogsDb.create({
      user_id: actor.id,
      user_email: actor.email,
      action: change > 0 ? 'stock_increase' : 'stock_decrease',
      entity_type: 'product',
      entity_id: productId,
      metadata: { change, reason, new_balance: newBalance },
    });

    const updated = await productsDb.getById(productId);
    return updated!;
  },

  async getInventoryHistory(limit: number = 50): Promise<InventoryLog[]> {
    return inventoryLogsDb.getRecent(limit);
  },

  async getAnalytics() {
    const [products, logs] = await Promise.all([
      productsDb.getAll({ onlyActive: true }),
      inventoryLogsDb.getRecent(500),
    ]);

    const lowStockProducts = products.data.filter(p => p.stock <= (p.min_stock ?? 5));

    // Monthly movement
    const monthlyMovement = new Map<string, { incoming: number; outgoing: number }>();
    for (const log of logs) {
      const month = log.created_at.substring(0, 7); // YYYY-MM
      const entry = monthlyMovement.get(month) ?? { incoming: 0, outgoing: 0 };
      if (log.change > 0) entry.incoming += log.change;
      else entry.outgoing += Math.abs(log.change);
      monthlyMovement.set(month, entry);
    }

    return {
      totalProducts: products.count,
      lowStockProducts,
      lowStockCount: lowStockProducts.length,
      monthlyMovement: Object.fromEntries(monthlyMovement),
    };
  },

  // ── PHASE 2 / 3 Scaffolding: These will eventually utilize pure Postgres RPCs ──

  async stockOpname(productId: string, actualStock: number, reason: string, actor: Actor): Promise<Product> {
    const product = await productsDb.getById(productId);
    if (!product) throw new Error('Product not found');
    const change = actualStock - product.stock;
    if (change === 0) return product; // No variance
    return this.adjustStock(productId, change, `Opname Variance: ${reason}`, actor, 'STOCK_OPNAME');
  },

  async recordSparePartUsage(issueId: string, productId: string, qty: number, actor: Actor): Promise<void> {
    // Deduct stock for a service job
    await this.adjustStock(productId, -Math.abs(qty), `Used for issue ${issueId}`, actor, 'SERVICE_PART');
  },

  async receivePurchase(poId: string, productId: string, qty: number, actor: Actor): Promise<void> {
    // Increase stock from supplier PO
    await this.adjustStock(productId, Math.abs(qty), `Received from PO ${poId}`, actor, 'PURCHASE_IN');
  },

  async executeStockTransfer(transferId: string, productId: string, qty: number, fromBranch: string, toBranch: string, actor: Actor): Promise<void> {
    // Logic will be atomic in Phase 3. For now, scaffold the intent.
    // await productsDb.decrementStock(productId, fromBranch...) -> 'TRANSFER_OUT'
    // await productsDb.incrementStock(productId, toBranch...) -> 'TRANSFER_IN'
    throw new Error('executeStockTransfer must be implemented via Postgres RPC to guarantee ACID compliance across branches.');
  }

};
