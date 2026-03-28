import { supabase, requireAuthUser } from './supabase';
import type { Product } from '@/types/types';
import { storageService } from './storage-service';

export const productService = {
  async fetchProducts(onlyPriced = false): Promise<Product[]> {
    // Join with price_list to get the latest price
    let query = supabase
      .from('products')
      .select('*, price_list(price)')
      .order('name', { ascending: true });

    if (onlyPriced) {
      query = query.eq('is_priced', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }

    // Flatten data to match Product type
    return (data || []).map((p: any) => ({
      ...p,
      price: p.price_list?.[0]?.price || 0,
    })) as Product[];
  },

  async getProduct(id: string): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .select('*, price_list(price)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }
    
    const p = data as any;
    return {
      ...p,
      price: p.price_list?.[0]?.price || 0,
    } as Product;
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>, imageFile?: File): Promise<Product> {
    const user = await requireAuthUser();
    
    let image = product.image;
    if (imageFile) {
      image = await storageService.uploadProductImage(imageFile);
    }

    // Warehouse registers product without price
    const newProduct = { 
      name: product.name,
      description: product.description,
      image,
      stock: product.stock || 0,
      category: product.category,
      status: product.status || 'in_stock',
      is_priced: false,
    };

    const { data, error } = await supabase
      .from('products')
      .insert(newProduct)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }
    return data as Product;
  },

  async updateProduct(id: string, updates: Partial<Product>, imageFile?: File): Promise<Product> {
    const user = await requireAuthUser();

    let image = updates.image;
    if (imageFile) {
      image = await storageService.uploadProductImage(imageFile);
    }

    const { price, ...productUpdates } = updates;
    const finalProductUpdates = { ...productUpdates, image };

    // 1. Update Products table
    const { data, error } = await supabase
      .from('products')
      .update(finalProductUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }

    // 2. Handle Price in price_list (Marketing/Admin action)
    if (price !== undefined) {
      const { error: priceError } = await supabase
        .from('price_list')
        .upsert({
          product_id: id,
          price: price,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' });

      if (priceError) {
        console.error('Price update error:', priceError);
      } else if (price > 0) {
        // Mark as priced on product table if price is valid
        await supabase.from('products').update({ is_priced: true }).eq('id', id);
      }
    }

    return { ...(data as Product), price: price || 0 };
  },

  async deleteProduct(id: string): Promise<void> {
    await requireAuthUser();

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', JSON.stringify(error, null, 2));
      throw new Error(error.message);
    }
  },
};
