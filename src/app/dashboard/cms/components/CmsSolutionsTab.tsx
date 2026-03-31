'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsSolution } from '@/types/types';
import { Modal } from '@/components/ui';

export default function CmsSolutionsTab() {
  const [items, setItems] = useState<CmsSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CmsSolution> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await cmsService.getSolutions();
      setItems(data);
    } catch (err: any) {
      alert(`Failed to load solutions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to deactivate/delete this solution?')) return;
    try {
      await cmsService.deleteSolution(id);
      alert('Removed successfully');
      loadData();
    } catch (err: any) {
      alert(`Failed to remove: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem?.id) {
        await cmsService.updateSolution(editingItem.id, editingItem);
      } else {
        await cmsService.createSolution({
          ...editingItem,
          sort_order: editingItem?.sort_order || 0,
        });
      }
      alert('Saved solution successfully');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await cmsService.uploadCmsAsset(file, 'solutions');
      setEditingItem((prev) => ({ ...prev, image_url: url }));
      alert('Image uploaded successfully');
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700";
  const btnClass = "bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 text-sm";
  const btnOutlineClass = "border border-gray-300 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-50 text-sm";
  const btnDangerClass = "bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 text-sm";

  if (loading) return <div className="p-4">Loading solutions...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-[var(--apple-border)]">
        <div>
          <h2 className="text-lg font-semibold">Solutions / Catalog</h2>
          <p className="text-sm text-gray-500">Products featured on the main landing page.</p>
        </div>
        <button className={btnClass} onClick={() => { setEditingItem({}); setIsModalOpen(true); }}>
          + Add Solution
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-[var(--apple-border)] shadow-sm flex flex-col gap-3">
            {item.image_url ? (
              <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover rounded-md" />
            ) : (
              <div className="h-32 w-full bg-gray-100 rounded-md flex items-center justify-center text-gray-400">No Image</div>
            )}
            <div>
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
            </div>
            <div className="flex gap-2 mt-auto pt-2 w-full border-t border-gray-100">
              <button className={`${btnOutlineClass} flex-1`} onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>Edit</button>
              <button className={`${btnDangerClass} flex-none`} onClick={(e) => handleDelete(item.id, e)}>Delete</button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="col-span-full text-center p-8 bg-white border border-dashed rounded-xl text-gray-500">
            No solutions found. Click "+ Add Solution" to create one.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem?.id ? 'Edit Solution' : 'New Solution'}>
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className={labelClass}>Title</label>
            <input className={inputClass} required value={editingItem?.title || ''} onChange={(e: any) => setEditingItem({ ...editingItem, title: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={3} required value={editingItem?.description || ''} onChange={(e: any) => setEditingItem({ ...editingItem, description: e.target.value })} />
          </div>
          
          <div className="space-y-2 flex flex-col gap-2">
            <label className={labelClass}>Image URL</label>
            <div className="flex gap-2 items-center">
              <input className={inputClass} value={editingItem?.image_url || ''} onChange={(e: any) => setEditingItem({ ...editingItem, image_url: e.target.value })} placeholder="https://..." readOnly />
              <input type="file" accept="image/*" onChange={handleImageUpload} className="w-48" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>Category</label>
              <input className={inputClass} value={editingItem?.category || ''} onChange={(e: any) => setEditingItem({ ...editingItem, category: e.target.value })} placeholder="e.g. Equipment" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Display Order</label>
              <input type="number" className={inputClass} value={editingItem?.sort_order || 0} onChange={(e: any) => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className={btnOutlineClass} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className={btnClass}>Save Solution</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
