import { supabase } from './supabase';
import type { Product } from '@/types/types';
import { storageService } from './storage-service';

export const productService = {
  async fetchProducts(onlyPriced = false): Promise<Product[]> {
    let query = supabase.from('products').select('*');

    if (onlyPriced) {
      query = query.eq('is_priced', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []) as Product[];
  },

  async getProduct(id: string): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Product;
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at'>, imageFile?: File): Promise<Product> {
    let image_url = product.image_url;
    
    if (imageFile) {
      image_url = await storageService.uploadProductImage(imageFile);
    }

    // Warehouse registers product without price
    const newProduct = { 
      name: product.name,
      description: product.description,
      image_url,
      price: null,
      is_priced: false 
    };

    const { data, error } = await supabase
      .from('products')
      .insert(newProduct)
      .select()
      .single();

    if (error) {
      console.error('Create product error:', error);
      throw new Error(error.message);
    }
    return data as Product;
  },

  async updateProduct(id: string, updates: Partial<Product>, imageFile?: File): Promise<Product> {
    let image_url = updates.image_url;

    if (imageFile) {
      image_url = await storageService.uploadProductImage(imageFile);
    }

    const finalUpdates = { ...updates, image_url };
    
    // If marketing sets a price, automatically mark as priced
    if (updates.price && updates.price > 0) {
      finalUpdates.is_priced = true;
    }

    const { data, error } = await supabase
      .from('products')
      .update(finalUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Product;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },
};
