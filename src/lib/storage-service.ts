import { supabase } from './supabase';

export const storageService = {
  async uploadProductImage(file: File): Promise<string> {
    const filePath = `products/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async deleteProductImage(url: string): Promise<void> {
    try {
      // Extract filename from URL
      const parts = url.split('/');
      const fileName = parts.pop();
      if (!fileName) return;
      
      const filePath = `products/${fileName}`;
      
      const { error } = await supabase.storage
        .from('products')
        .remove([filePath]);

      if (error) console.error('Delete image error:', error.message);
    } catch (err) {
      console.error('Delete image exception:', err);
    }
  }
};
