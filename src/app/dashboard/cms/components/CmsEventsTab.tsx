'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsEvent } from '@/types/types';
import { Modal } from '@/components/ui';

export default function CmsEventsTab() {
  const [items, setItems] = useState<CmsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CmsEvent> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await cmsService.getEvents();
      setItems(data);
    } catch (err: any) {
      alert(`Failed to load events: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await cmsService.deleteEvent(id);
      alert('Deleted successfully');
      loadData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem?.id) {
        await cmsService.updateEvent(editingItem.id, editingItem);
      } else {
        await cmsService.createEvent({
          ...editingItem,
          slug: editingItem?.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now().toString(),
        });
      }
      alert('Saved successfully');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700";
  const btnClass = "bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 text-sm";
  const btnOutlineClass = "border border-gray-300 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-50 text-sm";
  const btnDangerClass = "bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 text-sm";

  if (loading) return <div className="p-4">Loading events...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-[var(--apple-border)]">
        <h2 className="text-lg font-semibold">Events Directory</h2>
        <button className={btnClass} onClick={() => { setEditingItem({}); setIsModalOpen(true); }}>
          + Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-xl border border-[var(--apple-border)] shadow-sm flex flex-col gap-3">
            {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover rounded-lg" />}
            <div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <div className="text-sm text-gray-500 mt-1 flex flex-col gap-1">
                <span>🗓 {new Date(item.event_date).toLocaleString()}</span>
                <span>📍 {item.location || 'TBA'}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-auto pt-2 border-t">
              <button className={`${btnOutlineClass} flex-1`} onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>Edit</button>
              <button className={`${btnDangerClass} flex-1`} onClick={() => handleDelete(item.id)}>Delete</button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="col-span-full text-center p-8 bg-white border border-dashed rounded-xl text-gray-500">
            No events found. Create one.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem?.id ? 'Edit Event' : 'New Event'}>
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className={labelClass}>Event Title</label>
            <input className={inputClass} required value={editingItem?.title || ''} onChange={(e: any) => setEditingItem({ ...editingItem, title: e.target.value })} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass}>Date & Time</label>
              <input 
                className={inputClass}
                type="datetime-local" 
                required 
                value={editingItem?.event_date ? new Date(editingItem.event_date).toISOString().slice(0, 16) : ''} 
                onChange={(e: any) => setEditingItem({ ...editingItem, event_date: new Date(e.target.value).toISOString() })} 
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Location</label>
              <input className={inputClass} value={editingItem?.location || ''} onChange={(e: any) => setEditingItem({ ...editingItem, location: e.target.value })} placeholder="Virtual / Studio A" />
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Banner Image URL</label>
            <input className={inputClass} value={editingItem?.image_url || ''} onChange={(e: any) => setEditingItem({ ...editingItem, image_url: e.target.value })} placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} required rows={4} value={editingItem?.description || ''} onChange={(e: any) => setEditingItem({ ...editingItem, description: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className={btnOutlineClass} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className={btnClass}>Save Event</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
