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
    joined_date: initialProfile.joined_date ? initialProfile.joined_date.substring(0, 7) : '', // YYYY-MM
    quotes: initialProfile.quotes?.length ? initialProfile.quotes : [''],
  });

  const handleAddQuote = () => {
    if (formData.quotes.length >= 5) return;
    setFormData(prev => ({ ...prev, quotes: [...prev.quotes, ''] }));
  };

  const handleRemoveQuote = (index: number) => {
    setFormData(prev => ({
      ...prev,
      quotes: prev.quotes.filter((_, i) => i !== index),
    }));
  };

  const handleQuoteChange = (index: number, value: string) => {
    const newQuotes = [...formData.quotes];
    newQuotes[index] = value;
    setFormData(prev => ({ ...prev, quotes: newQuotes }));
  };

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
          joined_date: formData.joined_date ? `${formData.joined_date}-01` : null, // Store as full date
          quotes: formData.quotes.filter(q => q.trim() !== ''),
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

        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Month & Year Joined</label>
          <input 
            type="month" name="joined_date" value={formData.joined_date} onChange={handleChange} required
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

        <div className="space-y-3 pt-6 border-t border-gray-100">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Personal Work Quotes</label>
            <p className="text-[10px] text-gray-500 mt-1">Add between 3 to 5 motivational quotes or notes. These will rotate dynamically on the company page to inspire your colleagues!</p>
          </div>
          
          <div className="space-y-2">
            {formData.quotes.map((quote, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={quote}
                  onChange={(e) => handleQuoteChange(index, e.target.value)}
                  placeholder={`Quote ${index + 1}`}
                  className="flex-1 text-sm rounded-xl border-gray-200 px-4 py-2.5 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveQuote(index)}
                  disabled={formData.quotes.length <= 1}
                  className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                  title="Remove quote"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          
          {formData.quotes.length < 5 && (
            <button
              type="button"
              onClick={handleAddQuote}
              className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>+ Add Quote</span>
              <span className="text-blue-400 font-normal">({formData.quotes.length}/5)</span>
            </button>
          )}
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
