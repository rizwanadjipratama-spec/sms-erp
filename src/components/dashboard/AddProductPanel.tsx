'use client';

import { useState } from 'react';
import { Product } from '@/types/types';

interface AddProductPanelProps {
  onSave: (data: Partial<Product>, imageFile?: File) => Promise<void>;
  onCancel: () => void;
}

export function AddProductPanel({ onSave, onCancel }: AddProductPanelProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();

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
      // price and is_priced will be handled by productService internally 
      // but we pass them as null/false just in case
      await onSave({ 
        ...formData, 
        price: 0, // Placeholder, service will nullify or DB will handle
      }, imageFile);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-[2rem] border border-apple-gray-border shadow-sm p-8 sm:p-12 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-black text-apple-text-primary tracking-tight">Add New Product</h2>
          <p className="text-apple-text-secondary text-sm font-medium mt-1">Register a new item without pricing.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="group relative aspect-video bg-apple-gray-bg rounded-[2rem] border-2 border-dashed border-apple-gray-border hover:border-apple-blue transition-all duration-500 flex flex-col items-center justify-center overflow-hidden active:scale-[0.99]">
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="bg-white text-apple-text-primary text-[10px] font-bold px-6 py-3 rounded-apple cursor-pointer transition-all active:scale-95 shadow-2xl">CHANGE IMAGE</label>
              </div>
            </>
          ) : (
            <div className="text-center p-6 pointer-events-none">
              <svg className="w-12 h-12 mx-auto text-apple-gray-border mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs font-black text-apple-blue uppercase tracking-widest">Upload Product Photo</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="panel-image-upload" />
          <label htmlFor="panel-image-upload" className="absolute inset-0 cursor-pointer" />
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">PRODUCT NAME</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold"
              placeholder="e.g. Sparepart Printer Epson L3110"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">DESCRIPTION</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={5}
              className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium resize-none shadow-inner"
              placeholder="Provide technical specifications or details..."
            />
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-4 rounded-2xl border border-apple-gray-border font-bold text-xs text-apple-text-secondary hover:bg-apple-gray-bg transition-all active:scale-95"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-4 rounded-2xl bg-apple-text-primary text-white font-black text-xs hover:bg-black transition-all active:scale-95 shadow-2xl shadow-black/10 disabled:opacity-50 tracking-widest"
          >
            {isSubmitting ? 'SAVING...' : 'REGISTER PRODUCT'}
          </button>
        </div>
      </form>
    </div>
  );
}
