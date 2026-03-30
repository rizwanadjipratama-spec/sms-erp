'use client';

import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsSettings } from '@/types/types';

export default function CmsGeneralTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Partial<CmsSettings>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await cmsService.getSettings();
      if (data) setSettings(data);
    } catch (error: any) {
      alert(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await cmsService.updateSettings(settings);
      alert('Settings updated successfully');
    } catch (error: any) {
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof CmsSettings) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await cmsService.uploadCmsAsset(file, 'general');
      setSettings((prev) => ({ ...prev, [field]: url }));
      alert('Image uploaded successfully');
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700";

  if (loading) return <div className="animate-pulse space-y-4">Loading settings...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-8 bg-white p-6 rounded-2xl border border-[var(--apple-border)] shadow-sm">
      {/* Hero Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Hero Section</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Hero Title</label>
            <input
              className={inputClass}
              value={settings.hero_title || ''}
              onChange={(e: any) => setSettings({ ...settings, hero_title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Hero Subtitle</label>
            <input
              className={inputClass}
              value={settings.hero_subtitle || ''}
              onChange={(e: any) => setSettings({ ...settings, hero_subtitle: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2 flex flex-col gap-2">
            <label className={labelClass}>Hero Image URL</label>
            <div className="flex gap-2 items-center">
              <input
                className={inputClass}
                value={settings.hero_image_url || ''}
                onChange={(e: any) => setSettings({ ...settings, hero_image_url: e.target.value })}
                readOnly
              />
              <input type="file" accept="image/*" onChange={(e: any) => handleImageUpload(e, 'hero_image_url')} className="w-64" />
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">About Section</h3>
        <div className="space-y-2">
          <label className={labelClass}>About Heading</label>
          <input
            className={inputClass}
            value={settings.about_heading || ''}
            onChange={(e: any) => setSettings({ ...settings, about_heading: e.target.value })}
          />
        </div>
        <div className="space-y-2 flex flex-col gap-2">
          <label className={labelClass}>About Image URL</label>
          <div className="flex gap-2 items-center">
            <input
              className={inputClass}
              value={settings.about_image_url || ''}
              onChange={(e: any) => setSettings({ ...settings, about_image_url: e.target.value })}
              readOnly
            />
            <input type="file" accept="image/*" onChange={(e: any) => handleImageUpload(e, 'about_image_url')} className="w-64" />
          </div>
        </div>
        <div className="space-y-2">
          <label className={labelClass}>About Text</label>
          <textarea
            className={inputClass}
            rows={5}
            value={settings.about_text || ''}
            onChange={(e: any) => setSettings({ ...settings, about_text: e.target.value })}
          />
        </div>
      </div>

      {/* Announcement Banner */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Announcement Banner</h3>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="announcement_active"
            checked={settings.announcement_is_active || false}
            onChange={(e: any) => setSettings({ ...settings, announcement_is_active: e.target.checked })}
            className="rounded border-gray-300 text-[var(--apple-blue)] focus:ring-[var(--apple-blue)]"
          />
          <label htmlFor="announcement_active" className={`${labelClass} cursor-pointer`}>Enable Global Banner</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Announcement Text</label>
            <input
              className={inputClass}
              value={settings.announcement_text || ''}
              onChange={(e: any) => setSettings({ ...settings, announcement_text: e.target.value })}
              disabled={!settings.announcement_is_active}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Announcement Link (Optional URL)</label>
            <input
              className={inputClass}
              value={settings.announcement_link || ''}
              onChange={(e: any) => setSettings({ ...settings, announcement_link: e.target.value })}
              disabled={!settings.announcement_is_active}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Company Info (Footer)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Company Name</label>
            <input className={inputClass} value={settings.company_name || ''} onChange={(e: any) => setSettings({ ...settings, company_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Company Email</label>
            <input className={inputClass} value={settings.company_email || ''} onChange={(e: any) => setSettings({ ...settings, company_email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Company Phone</label>
            <input className={inputClass} value={settings.company_phone || ''} onChange={(e: any) => setSettings({ ...settings, company_phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Company Address</label>
            <input className={inputClass} value={settings.company_address || ''} onChange={(e: any) => setSettings({ ...settings, company_address: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
