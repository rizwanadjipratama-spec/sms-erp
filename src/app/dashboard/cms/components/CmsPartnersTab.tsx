'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsPartner } from '@/types/types';
import { Modal } from '@/components/ui';

export default function CmsPartnersTab() {
  const [items, setItems] = useState<CmsPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CmsPartner> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await cmsService.getPartners();
      setItems(data);
    } catch (err: any) {
      alert(`Failed to load partners: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this partner?')) return;
    try {
      await cmsService.deletePartner(id);
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
        await cmsService.updatePartner(editingItem.id, editingItem);
      } else {
        await cmsService.createPartner({
          ...editingItem,
          sort_order: editingItem?.sort_order || 0,
        });
      }
      alert('Saved partner successfully');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await cmsService.uploadCmsAsset(file, 'partners');
      setEditingItem((prev) => ({ ...prev, logo_url: url }));
      alert('Logo uploaded successfully');
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700";
  const btnClass = "bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 text-sm";
  const btnOutlineClass = "border border-gray-300 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-50 text-sm";
  const btnDangerClass = "bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 text-sm";

  if (loading) return <div className="p-4">Loading partners...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-[var(--apple-border)]">
        <h2 className="text-lg font-semibold">Partners & Sponsors</h2>
        <button className={btnClass} onClick={() => { setEditingItem({}); setIsModalOpen(true); }}>
          + Add Partner
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-[var(--apple-border)] shadow-sm flex flex-col items-center gap-3 text-center">
            {item.logo_url ? (
              <img src={item.logo_url} alt={item.name} className="h-16 object-contain" />
            ) : (
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">No Logo</div>
            )}
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-xs text-gray-500">Order: {item.sort_order}</p>
            </div>
            <div className="flex gap-2 mt-auto pt-2 w-full">
              <button className={`${btnOutlineClass} flex-1 px-2 text-xs`} onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>Edit</button>
              <button className={`${btnDangerClass} flex-1 px-2 text-xs`} onClick={() => handleDelete(item.id)}>Del</button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="col-span-full text-center p-8 bg-white border border-dashed rounded-xl text-gray-500">
            No partners found.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem?.id ? 'Edit Partner' : 'New Partner'}>
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className={labelClass}>Partner Name</label>
            <input className={inputClass} required value={editingItem?.name || ''} onChange={(e: any) => setEditingItem({ ...editingItem, name: e.target.value })} />
          </div>
          
          <div className="space-y-2">
            <label className={labelClass}>Logo URL</label>
            <div className="flex gap-2 items-center">
              <input className={inputClass} value={editingItem?.logo_url || ''} onChange={(e: any) => setEditingItem({ ...editingItem, logo_url: e.target.value })} placeholder="https://..." readOnly />
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-48" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>Website URL (Optional)</label>
              <input className={inputClass} value={editingItem?.website_url || ''} onChange={(e: any) => setEditingItem({ ...editingItem, website_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Display Order</label>
              <input className={inputClass} type="number" required value={editingItem?.sort_order || 0} onChange={(e: any) => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className={btnOutlineClass} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className={btnClass}>Save Partner</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
