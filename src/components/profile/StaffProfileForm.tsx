'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/types';

interface StaffProfileFormProps {
  initialProfile: Profile;
  onUpdate: (updated: Partial<Profile>) => void;
}

export function StaffProfileForm({ initialProfile, onUpdate }: StaffProfileFormProps) {
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: initialProfile.name || '',
    phone: initialProfile.phone || '',
    bio: initialProfile.bio || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone: formData.phone,
          bio: formData.bio,
          profile_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', initialProfile.id);

      if (error) throw error;
      onUpdate(formData);
      alert('Profile updated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Job Title / Role</p>
          <p className="font-bold text-gray-900 capitalize text-lg">{initialProfile.role.replace('_', ' ')}</p>
        </div>
        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex flex-col justify-center">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Office Location</p>
          <p className="font-bold text-gray-900 text-lg">
            {initialProfile.branch?.name || 'Headquarters'}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Full Name</label>
          <input 
            type="text" name="name" value={formData.name} onChange={handleChange} required
            className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Phone Number / WhatsApp</label>
          <input 
            type="tel" name="phone" value={formData.phone} onChange={handleChange} required
            className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="space-y-1.5 w-full">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Short Bio / About Me</label>
          <textarea 
            name="bio" rows={4} value={formData.bio} onChange={handleChange}
            placeholder="Tell your local colleagues a bit about yourself..."
            className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-gray-100 flex justify-end">
        <button 
          type="submit" disabled={saving}
          className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
