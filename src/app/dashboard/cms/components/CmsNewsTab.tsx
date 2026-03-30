'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsNews } from '@/types/types';
import { Modal } from '@/components/ui';

export default function CmsNewsTab() {
  const [items, setItems] = useState<CmsNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CmsNews> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await cmsService.getNews();
      setItems(data);
    } catch (err: any) {
      alert(`Failed to load news: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this news article?')) return;
    try {
      await cmsService.deleteNews(id);
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
        await cmsService.updateNews(editingItem.id, editingItem);
      } else {
        await cmsService.createNews({
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

  if (loading) return <div className="p-4">Loading news...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-[var(--apple-border)]">
        <h2 className="text-lg font-semibold">News & Updates</h2>
        <button className={btnClass} onClick={() => { setEditingItem({}); setIsModalOpen(true); }}>
          + Add Article
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-xl border border-[var(--apple-border)] shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
            {item.image_url && <img src={item.image_url} alt={item.title} className="w-24 h-24 object-cover rounded-lg" />}
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{item.content}</p>
              <div className="mt-2 text-xs text-gray-400 flex gap-4">
                <span>By: {item.creator?.name || 'Unknown'}</span>
                <span>Visibility: <span className={item.is_published ? 'text-green-600 font-bold' : 'text-orange-500 font-bold'}>{item.is_published ? 'Published' : 'Draft'}</span></span>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              <button className={btnOutlineClass} onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>Edit</button>
              <button className={btnDangerClass} onClick={() => handleDelete(item.id)}>Delete</button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center p-8 bg-white border border-dashed rounded-xl text-gray-500">
            No news articles found. Create one.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem?.id ? 'Edit Article' : 'New Article'}>
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className={labelClass}>Title</label>
            <input className={inputClass} required value={editingItem?.title || ''} onChange={(e: any) => setEditingItem({ ...editingItem, title: e.target.value })} />
          </div>
          
          <div className="space-y-2">
            <label className={labelClass}>Image Header URL</label>
            <input className={inputClass} value={editingItem?.image_url || ''} onChange={(e: any) => setEditingItem({ ...editingItem, image_url: e.target.value })} placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Content (Markdown support can be added later)</label>
            <textarea className={inputClass} required rows={6} value={editingItem?.content || ''} onChange={(e: any) => setEditingItem({ ...editingItem, content: e.target.value })} />
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_pub"
              checked={editingItem?.is_published || false}
              onChange={(e: any) => setEditingItem({ ...editingItem, is_published: e.target.checked })}
              className="rounded text-blue-600"
            />
            <label htmlFor="is_pub" className={`${labelClass} cursor-pointer`}>Published to public</label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className={btnOutlineClass} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className={btnClass}>Save Article</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
