// ============================================================================
// PRODUCT SERVICE — Product CRUD and pricing
// ============================================================================

import { productsDb, priceListDb, storageDb, activityLogsDb } from '@/lib/db';
import type { Product, PriceList, Actor, PaginationParams } from '@/types/types';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Allowed: PNG, JPG, JPEG, WEBP`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 5MB`);
  }
}

export const productService = {
  async getAll(options?: { onlyPriced?: boolean; pagination?: PaginationParams; branchId?: string }) {
    return productsDb.getAll(options);
  },

  async getActive(branchId?: string): Promise<Product[]> {
    const { data } = await productsDb.getAll({ onlyActive: true, branchId });
    return data;
  },

  async getById(id: string) {
    return productsDb.getById(id);
  },

  async getByIds(ids: string[]) {
    return productsDb.getByIds(ids);
  },

  async create(product: {
    name: string;
    description?: string;
    sku?: string;
    category?: Product['category'];
    stock?: number;
    min_stock?: number;
    unit?: string;
    branch_id?: string;
    technician_id?: string;
    serial_number?: string;
    location?: string;
    equipment_type?: string;
  }, imageFile?: File, actor?: Actor): Promise<Product> {
    if (imageFile) validateImageFile(imageFile);

    let image_url: string | undefined;
    if (imageFile) {
      const ext = imageFile.name.split('.').pop() ?? 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      image_url = await storageDb.upload('products', path, imageFile);
    }

    const created = await productsDb.create({
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      image_url,
      stock: product.stock ?? 0,
      min_stock: product.min_stock ?? 5,
      unit: product.unit ?? 'pcs',
      branch_id: product.branch_id,
      technician_id: product.technician_id,
      serial_number: product.serial_number,
      location: product.location,
      equipment_type: product.equipment_type,
      is_active: true,
      created_by: actor?.id,
    });

    if (actor) {
      await activityLogsDb.create({
        user_id: actor.id,
        user_email: actor.email,
        action: 'create_product',
        entity_type: 'product',
        entity_id: created.id,
        metadata: { name: product.name },
      });
    }

    return created;
  },

  async update(id: string, updates: {
    name?: string;
    description?: string;
    sku?: string;
    category?: Product['category'];
    stock?: number;
    min_stock?: number;
    unit?: string;
    is_active?: boolean;
    technician_id?: string;
    serial_number?: string;
    location?: string;
    equipment_type?: string;
  }, imageFile?: File, actor?: Actor): Promise<Product> {
    if (imageFile) validateImageFile(imageFile);

    let image_url: string | undefined;
    if (imageFile) {
      // Upload new image
      const ext = imageFile.name.split('.').pop() ?? 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      image_url = await storageDb.upload('products', path, imageFile);

      // Delete old image if exists
      const existing = await productsDb.getById(id);
      if (existing?.image_url) {
        const oldPath = existing.image_url.split('/products/').pop();
        if (oldPath) {
          await storageDb.delete('products', [oldPath]).catch(() => {});
        }
      }
    }

    const updated = await productsDb.update(id, {
      ...updates,
      ...(image_url ? { image_url } : {}),
      updated_by: actor?.id,
    });

    if (actor) {
      await activityLogsDb.create({
        user_id: actor.id,
        user_email: actor.email,
        action: 'update_product',
        entity_type: 'product',
        entity_id: id,
      });
    }

    return updated;
  },

  async delete(id: string, actor?: Actor): Promise<void> {
    const existing = await productsDb.getById(id);
    if (existing?.image_url) {
      const path = existing.image_url.split('/products/').pop();
      if (path) {
        await storageDb.delete('products', [path]).catch(() => {});
      }
    }

    await productsDb.delete(id);

    if (actor) {
      await activityLogsDb.create({
        user_id: actor.id,
        user_email: actor.email,
        action: 'delete_product',
        entity_type: 'product',
        entity_id: id,
        metadata: { name: existing?.name },
      });
    }
  },

  async setPrice(productId: string, priceRegular: number, priceKso: number, actor?: Actor): Promise<PriceList> {
    if (priceRegular < 0 || priceKso < 0) {
      throw new Error('Prices cannot be negative');
    }

    const price = await priceListDb.upsert({
      product_id: productId,
      price_regular: priceRegular,
      price_kso: priceKso,
      created_by: actor?.id,
      updated_by: actor?.id,
    });

    if (actor) {
      await activityLogsDb.create({
        user_id: actor.id,
        user_email: actor.email,
        action: 'set_price',
        entity_type: 'price_list',
        entity_id: price.id,
        metadata: { product_id: productId, price_regular: priceRegular, price_kso: priceKso },
      });
    }

    return price;
  },
};
