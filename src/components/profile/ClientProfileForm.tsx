'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, ClientType } from '@/types/types';

interface ClientProfileFormProps {
  initialProfile: Profile;
  onUpdate: (updated: Partial<Profile>) => void;
}

const CLIENT_TYPES: { value: ClientType; label: string; description: string }[] = [
  { value: 'regular', label: 'Regular', description: 'Standard pricing for direct purchases.' },
  { value: 'kso', label: 'KSO', description: 'Kerjasama Operasional — partnership pricing.' },
  { value: 'cost_per_test', label: 'Cost Per Test', description: 'Pay per test usage, no upfront product cost.' },
];

export function ClientProfileForm({ initialProfile, onUpdate }: ClientProfileFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: initialProfile.name || '',
    phone: initialProfile.phone || '',
    pic_name: initialProfile.pic_name || '',
    company: initialProfile.company || '',
    address: initialProfile.address || '',
    city: initialProfile.city || '',
    province: initialProfile.province || '',
    client_type: (initialProfile.client_type || '') as ClientType | '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isValid =
    formData.name.trim() &&
    formData.phone.trim() &&
    formData.pic_name.trim() &&
    formData.company.trim() &&
    formData.address.trim() &&
    formData.city.trim() &&
    formData.province.trim() &&
    formData.client_type;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        pic_name: formData.pic_name.trim(),
        company: formData.company.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        province: formData.province.trim(),
        client_type: formData.client_type as ClientType,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      };
      const { error: dbError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', initialProfile.id);

      if (dbError) throw dbError;
      onUpdate(payload);
      alert('Profile saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Section 1: Personal Information ── */}
      <div className="space-y-5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Personal Information</h3>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
            <input 
              type="text" name="name" value={formData.name} onChange={handleChange} required
              placeholder="Your full name"
              className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold placeholder:font-normal placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Phone / WhatsApp <span className="text-red-500">*</span></label>
            <input 
              type="tel" name="phone" value={formData.phone} onChange={handleChange} required
              placeholder="08xx-xxxx-xxxx"
              className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold placeholder:font-normal placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">PIC Name <span className="text-red-500">*</span></label>
            <input 
              type="text" name="pic_name" value={formData.pic_name} onChange={handleChange} required
              placeholder="Person in charge at your institution"
              className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold placeholder:font-normal placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Institution Details ── */}
      <div className="space-y-5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Institution Details</h3>

        <div className="grid gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Hospital / Clinic / Institution Name <span className="text-red-500">*</span></label>
            <input 
              type="text" name="company" value={formData.company} onChange={handleChange} required
              placeholder="e.g. RS Harapan Kita"
              className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold placeholder:font-normal placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Full Address <span className="text-red-500">*</span></label>
            <textarea 
              name="address" rows={3} value={formData.address} onChange={handleChange} required
              placeholder="Complete street address"
              className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-medium placeholder:text-gray-400"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">City <span className="text-red-500">*</span></label>
              <input 
                type="text" name="city" value={formData.city} onChange={handleChange} required
                placeholder="e.g. Jakarta Selatan"
                className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold placeholder:font-normal placeholder:text-gray-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Province <span className="text-red-500">*</span></label>
              <input 
                type="text" name="province" value={formData.province} onChange={handleChange} required
                placeholder="e.g. DKI Jakarta"
                className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold placeholder:font-normal placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Client Type ── */}
      <div className="space-y-5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Client Type <span className="text-red-500">*</span></h3>

        <div className="grid gap-3">
          {CLIENT_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                formData.client_type === type.value
                  ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                  : 'border-gray-200 hover:border-blue-300 bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="client_type"
                value={type.value}
                checked={formData.client_type === type.value}
                onChange={handleChange}
                className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-bold text-gray-900">{type.label}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{type.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold border border-red-100">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {!isValid && (
          <p className="text-xs text-amber-600 font-semibold">⚠️ Please fill in all required fields to save.</p>
        )}
        <button 
          type="submit" disabled={saving || !isValid}
          className="ml-auto px-10 py-3.5 rounded-xl text-sm font-black text-white bg-gray-900 hover:bg-black active:scale-[0.98] transition-all shadow-lg shadow-black/10 disabled:opacity-40 tracking-wider"
        >
          {saving ? 'SAVING...' : 'SAVE PROFILE'}
        </button>
      </div>
    </form>
  );
}
