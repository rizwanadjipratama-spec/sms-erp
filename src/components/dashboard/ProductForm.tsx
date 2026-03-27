'use client';

import { useState } from 'react';
import { Product } from '@/types/types';

interface ProductFormProps {
  product?: Product;
  onSave: (data: Partial<Product>, imageFile?: File) => Promise<void>;
  onClose: () => void;
}

export function ProductForm({ product, onSave, onClose }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || 0,
    image_url: product?.image_url || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(product?.image_url);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData, imageFile);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-white/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-white rounded-[2rem] border border-apple-gray-border shadow-2xl w-full max-w-lg overflow-hidden relative animate-in zoom-in-95 slide-in-from-bottom-5 duration-500">
        <div className="p-8 sm:p-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-apple-text-primary tracking-tight">
              {product ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-apple-gray-bg rounded-full transition-colors text-apple-text-secondary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="group relative aspect-video bg-apple-gray-bg rounded-2xl border-2 border-dashed border-apple-gray-border hover:border-apple-blue transition-all duration-500 flex flex-col items-center justify-center overflow-hidden active:scale-[0.98]">
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="bg-white text-apple-text-primary text-[10px] font-bold px-4 py-2 rounded-apple cursor-pointer transition-all active:scale-95 shadow-xl">CHANGE IMAGE</label>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 pointer-events-none">
                  <svg className="w-10 h-10 mx-auto text-apple-gray-border mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <label className="text-xs font-black text-apple-blue uppercase tracking-widest">Upload Product Photo</label>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="image-upload" />
              <label htmlFor="image-upload" className="absolute inset-0 cursor-pointer" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">PRODUCT NAME</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium"
                  placeholder="e.g. Printer Sparepart A"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">PRICE (IDR)</label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={e => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-bold text-apple-blue"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">DESCRIPTION</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium resize-none shadow-inner"
                  placeholder="Describe the product features..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3.5 rounded-xl border border-apple-gray-border font-bold text-xs text-apple-text-secondary hover:bg-apple-gray-bg transition-all active:scale-95"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3.5 rounded-xl bg-apple-text-primary text-white font-black text-xs hover:bg-black transition-all active:scale-95 shadow-xl shadow-black/10 disabled:opacity-50"
              >
                {isSubmitting ? 'SAVING...' : 'SAVE PRODUCT'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
