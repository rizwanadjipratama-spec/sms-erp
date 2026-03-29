'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { profilesDb } from '@/lib/db';
import { authService } from '@/lib/services/auth-service';
import type { ClientType } from '@/types/types';

const CLIENT_TYPES: { value: ClientType; label: string; description: string }[] = [
  { value: 'regular', label: 'Regular', description: 'Standard pricing for direct purchases.' },
  { value: 'kso', label: 'KSO', description: 'Kerjasama Operasional — partnership pricing.' },
  { value: 'cost_per_test', label: 'Cost Per Test', description: 'Pay per test usage, no upfront product cost.' },
];

export default function ClientSetupPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    company: profile?.company || '',
    address: profile?.address || '',
    phone: profile?.phone || '',
    client_type: (profile?.client_type || '') as ClientType | '',
    pic_name: profile?.pic_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!profile) return null;

  // If profile is already complete, redirect to dashboard
  if (authService.isProfileComplete(profile)) {
    router.replace('/dashboard/client');
    return null;
  }

  const isValid =
    formData.name.trim() &&
    formData.company.trim() &&
    formData.address.trim() &&
    formData.phone.trim() &&
    formData.client_type &&
    formData.pic_name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSaving(true);
    setError('');
    try {
      await profilesDb.update(profile.id, {
        name: formData.name.trim(),
        company: formData.company.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        client_type: formData.client_type as ClientType,
        pic_name: formData.pic_name.trim(),
      });
      await refreshProfile();
      router.push('/dashboard/client');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-apple-blue/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-apple-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">
            Complete Your Profile
          </h1>
          <p className="text-apple-text-secondary text-sm font-medium mt-2 max-w-md mx-auto">
            Please fill in your institution details to start using the system. All fields are required.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info Card */}
          <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">
              Personal Information
            </h3>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold placeholder:font-normal placeholder:text-apple-text-secondary/40"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold placeholder:font-normal placeholder:text-apple-text-secondary/40"
                placeholder="08xx-xxxx-xxxx"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                PIC Name *
              </label>
              <input
                type="text"
                required
                value={formData.pic_name}
                onChange={(e) => updateField('pic_name', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold placeholder:font-normal placeholder:text-apple-text-secondary/40"
                placeholder="Person in charge at your institution"
              />
            </div>
          </div>

          {/* Institution Card */}
          <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">
              Institution Details
            </h3>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Hospital / Clinic / Institution Name *
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => updateField('company', e.target.value)}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-semibold placeholder:font-normal placeholder:text-apple-text-secondary/40"
                placeholder="e.g. RS Harapan Kita"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-apple-text-secondary mb-2 ml-1">
                Full Address *
              </label>
              <textarea
                required
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                rows={3}
                className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium resize-none placeholder:text-apple-text-secondary/40"
                placeholder="Complete address including city and postal code"
              />
            </div>
          </div>

          {/* Client Type Card */}
          <div className="bg-white rounded-2xl border border-apple-gray-border shadow-sm p-6 sm:p-8 space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-apple-text-secondary">
              Client Type *
            </h3>

            <div className="grid gap-3">
              {CLIENT_TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    formData.client_type === type.value
                      ? 'border-apple-blue bg-apple-blue/5'
                      : 'border-apple-gray-border hover:border-apple-blue/30 bg-apple-gray-bg'
                  }`}
                >
                  <input
                    type="radio"
                    name="client_type"
                    value={type.value}
                    checked={formData.client_type === type.value}
                    onChange={(e) => updateField('client_type', e.target.value)}
                    className="mt-0.5 w-4 h-4 text-apple-blue focus:ring-apple-blue"
                  />
                  <div>
                    <p className="text-sm font-bold text-apple-text-primary">{type.label}</p>
                    <p className="text-xs text-apple-text-secondary font-medium mt-0.5">
                      {type.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-apple-danger/10 text-apple-danger px-4 py-3 rounded-xl text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !isValid}
            className="w-full py-4 rounded-2xl bg-apple-text-primary text-white font-black text-sm hover:bg-black transition-all active:scale-[0.98] shadow-xl shadow-black/10 disabled:opacity-40 tracking-widest"
          >
            {saving ? 'SAVING...' : 'COMPLETE PROFILE'}
          </button>
        </form>
      </div>
    </div>
  );
}
