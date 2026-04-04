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

interface AddProductPanelProps {
  onSave: (data: Partial<Product>, imageFile?: File) => Promise<void>;
  onCancel: () => void;
}

export function AddProductPanel({ onSave, onCancel }: AddProductPanelProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category: '' as ProductCategory | '',
    unit: 'pcs',
    stock: 0,
    min_stock: 5,
    nie: '',
    lot_number: '',
    expiry_date: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
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
          nie: formData.nie.trim() || undefined,
          lot_number: formData.lot_number.trim() || undefined,
          expiry_date: formData.expiry_date || undefined,
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
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-apple-text-primary tracking-tight">
            Add New Product
          </h2>
          <p className="text-apple-text-secondary text-sm font-medium mt-1">
            Register a new item to the warehouse catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2.5 hover:bg-apple-gray-bg rounded-xl transition-colors text-apple-text-secondary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Image Upload */}
        <div
          className={`group relative aspect-[2/1] bg-apple-gray-bg rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
            dragOver
              ? 'border-apple-blue bg-apple-blue/5 scale-[1.01]'
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
                <span className="bg-white text-apple-text-primary text-[10px] font-bold px-6 py-3 rounded-xl shadow-2xl tracking-widest">
                  CHANGE IMAGE
                </span>
              </div>
            </>
          ) : (
            <div className="text-center p-6 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-apple-blue/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-apple-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-xs font-black text-apple-blue uppercase tracking-widest mb-1">
                Upload Product Photo
              </p>
              <p className="text-[10px] text-apple-text-secondary font-medium">
                PNG, JPG, WEBP up to 5MB — drag & drop or tap
              </p>
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            className="hidden"
            id="panel-image-upload"
          />
          <label htmlFor="panel-image-upload" className="absolute inset-0 cursor-pointer" />
        </div>

        {/* Product Details Card */}
        <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">
            Product Details
          </h3>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold placeholder:font-normal placeholder:text-apple-text-secondary/40"
              placeholder="e.g. Hematology Analyzer XN-1000"
            />
          </div>

          {/* SKU + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                SKU
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium placeholder:text-apple-text-secondary/40"
                placeholder="e.g. HEMA-XN1000"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => updateField('category', e.target.value as ProductCategory)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium appearance-none"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium resize-none placeholder:text-apple-text-secondary/40"
              placeholder="Technical specifications or product details..."
            />
          </div>
        </div>

        {/* Regulatory & Tracking Card */}
        <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">
            Regulatory & Batch Tracking
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* NIE / AKL */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                NIE / AKL
              </label>
              <input
                type="text"
                value={formData.nie}
                onChange={(e) => updateField('nie', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium placeholder:text-apple-text-secondary/40"
                placeholder="e.g. AKL 20101234567"
              />
            </div>

            {/* LOT Number */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                LOT Number
              </label>
              <input
                type="text"
                value={formData.lot_number}
                onChange={(e) => updateField('lot_number', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium placeholder:text-apple-text-secondary/40"
                placeholder="e.g. LOT-2026-A1"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => updateField('expiry_date', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Stock & Unit Card */}
        <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">
            Inventory Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Unit */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => updateField('unit', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium appearance-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Initial Stock */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Initial Stock
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => updateField('stock', Math.max(0, Number(e.target.value)))}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-bold"
              />
            </div>

            {/* Min Stock Warning */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Min Stock Alert
              </label>
              <input
                type="number"
                min="0"
                value={formData.min_stock}
                onChange={(e) => updateField('min_stock', Math.max(0, Number(e.target.value)))}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-bold"
              />
            </div>
          </div>

          {formData.stock > 0 && formData.stock <= formData.min_stock && (
            <div className="flex items-center gap-2 bg-apple-warning/10 text-apple-warning px-4 py-2.5 rounded-xl">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-bold">
                Initial stock is at or below minimum alert threshold.
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-4 rounded-2xl border border-apple-gray-border font-bold text-xs text-apple-text-secondary hover:bg-apple-gray-bg transition-all active:scale-[0.98] tracking-widest"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.name.trim()}
            className="flex-1 px-6 py-4 rounded-2xl bg-apple-text-primary text-white font-black text-xs hover:bg-black transition-all active:scale-[0.98] shadow-xl shadow-black/10 disabled:opacity-40 tracking-widest"
          >
            {isSubmitting ? 'REGISTERING...' : 'REGISTER PRODUCT'}
          </button>
        </div>
      </form>
    </div>
  );
}
