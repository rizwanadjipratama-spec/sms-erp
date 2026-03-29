'use client';

import { useState } from 'react';
import type { Product, ProductCategory } from '@/types/types';

const CATEGORIES: ProductCategory[] = [
  'Equipment',
  'Consumables',
  'Reagents',
  'Service & Support',
  'Service',
];

const UNITS = ['pcs', 'box', 'kit', 'unit', 'set', 'bottle', 'pack', 'roll', 'pair', 'tube'];

interface ProductFormProps {
  product?: Product;
  onSave: (data: Partial<Product>, imageFile?: File) => Promise<void>;
  onClose: () => void;
}

export function ProductForm({ product, onSave, onClose }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    sku: product?.sku || '',
    category: (product?.category || '') as ProductCategory | '',
    unit: product?.unit || 'pcs',
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 5,
    is_active: product?.is_active ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(product?.image_url);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Only PNG, JPG, JPEG, WEBP files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum 5MB.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(
        {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          sku: formData.sku.trim() || undefined,
          category: formData.category || undefined,
          unit: formData.unit,
          stock: formData.stock,
          min_stock: formData.min_stock,
          is_active: formData.is_active,
        },
        imageFile
      );
    } catch {
      // error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="bg-white rounded-2xl border border-apple-gray-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-apple-text-primary tracking-tight">
              {product ? 'Edit Product' : 'Add Product'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-apple-gray-bg rounded-xl transition-colors text-apple-text-secondary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Image Upload */}
            <div
              className={`group relative aspect-[2/1] bg-apple-gray-bg rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
                dragOver
                  ? 'border-apple-blue bg-apple-blue/5'
                  : 'border-apple-gray-border hover:border-apple-blue/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="bg-white text-apple-text-primary text-[10px] font-bold px-5 py-2.5 rounded-xl shadow-xl tracking-widest">
                      CHANGE IMAGE
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 pointer-events-none">
                  <svg className="w-8 h-8 mx-auto text-apple-gray-border mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[10px] font-black text-apple-blue uppercase tracking-widest">
                    Upload Photo
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="edit-image-upload"
              />
              <label htmlFor="edit-image-upload" className="absolute inset-0 cursor-pointer" />
            </div>

            {/* Name */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold placeholder:font-normal placeholder:text-apple-text-secondary/40"
                placeholder="Product name"
              />
            </div>

            {/* SKU + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => updateField('sku', e.target.value)}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium placeholder:text-apple-text-secondary/40"
                  placeholder="SKU code"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value as ProductCategory)}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium appearance-none"
                >
                  <option value="">Select</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium resize-none placeholder:text-apple-text-secondary/40"
                placeholder="Technical specs or details..."
              />
            </div>

            {/* Unit + Stock + Min Stock */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                  Unit
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium appearance-none"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                  Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => updateField('stock', Math.max(0, Number(e.target.value)))}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-1.5 ml-1">
                  Min Alert
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) => updateField('min_stock', Math.max(0, Number(e.target.value)))}
                  className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-bold"
                />
              </div>
            </div>

            {/* Active Toggle */}
            {product && (
              <div className="flex items-center justify-between bg-apple-gray-bg rounded-xl px-4 py-3 border border-apple-gray-border">
                <div>
                  <p className="text-sm font-bold text-apple-text-primary">Product Active</p>
                  <p className="text-[10px] text-apple-text-secondary font-medium">
                    Inactive products are hidden from clients.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('is_active', !formData.is_active)}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${
                    formData.is_active ? 'bg-apple-success' : 'bg-apple-gray-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                      formData.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-apple-gray-border font-bold text-xs text-apple-text-secondary hover:bg-apple-gray-bg transition-all active:scale-[0.98] tracking-widest"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-1 px-4 py-3 rounded-xl bg-apple-text-primary text-white font-black text-xs hover:bg-black transition-all active:scale-[0.98] shadow-xl shadow-black/10 disabled:opacity-40 tracking-widest"
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
