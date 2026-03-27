import { supabase } from './supabase';
import type { PriceList, ClientType } from '@/types/types';

export const getPriceList = async (): Promise<PriceList[]> => {
  const { data, error } = await supabase
    .from('price_list')
    .select('*, products(name)')
    .order('product_id');

  if (error) {
    console.error('Error fetching price list:', error);
    return [];
  }

  return (data || []).map((row) => ({
    ...row,
    product_name: row.products?.name,
  })) as PriceList[];
};

export const getPriceForProduct = async (
  productId: string,
  clientType: ClientType
): Promise<number> => {
  const { data, error } = await supabase
    .from('price_list')
    .select('price_regular, price_kso')
    .eq('product_id', productId)
    .maybeSingle();

  if (error || !data) return 0;

  return clientType === 'kso' ? data.price_kso : data.price_regular;
};

export const upsertPriceList = async (
  productId: string,
  priceRegular: number,
  priceKso: number
): Promise<void> => {
  const { error } = await supabase.from('price_list').upsert(
    {
      product_id: productId,
      price_regular: priceRegular,
      price_kso: priceKso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'product_id' }
  );

  if (error) throw new Error(error.message);

  // Sync is_priced flag to products table
  await supabase
    .from('products')
    .update({ is_priced: true })
    .eq('id', productId);
};

export const deletePriceEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from('price_list').delete().eq('id', id);
  if (error) throw new Error(error.message);
};
