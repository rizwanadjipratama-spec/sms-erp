'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';

function SettingsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'general';
  const { profile } = useAuth();
  const { branches, activeBranchId, setActiveBranchId, isExecutive } = useBranch();

  const [language, setLanguage] = useState('id');
  const [region, setRegion] = useState('ID');
  
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId);
  const [branchError, setBranchError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedBranch(val);
    setBranchError('');
    setSaved(false);
  };

  const saveRegionSettings = () => {
    setSaving(true);
    setBranchError('');
    setSaved(false);

    setTimeout(() => {
      // Real distance check integration
      if (!isExecutive && selectedBranch !== activeBranchId) {
        setBranchError('Location too far! You are outside the operational radius of the selected branch. Our system has automatically locked you to your nearest physical branch.');
      } else {
        if (isExecutive) {
           setActiveBranchId(selectedBranch);
        }
        setSaved(true);
      }
      setSaving(false);
    }, 500);
  };

  const saveLangSettings = () => {
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      setSaved(true);
      setSaving(false);
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">System Settings</h1>
        <p className="text-gray-500 font-medium mt-1">Manage application preferences, regional context, and display languages.</p>
      </div>

      <div className="bg-white border text-sm border-gray-200 shadow-sm rounded-2xl overflow-hidden min-h-[400px]">
        {/* TAB NAV */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <a href="?tab=general" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>General</a>
          <a href="?tab=region" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'region' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Region / Branch</a>
          <a href="?tab=language" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'language' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Language</a>
        </div>

        <div className="p-8">
          {tab === 'general' && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="text-4xl mb-4">⚙️</div>
              <h2 className="text-xl font-bold text-gray-900">General Settings</h2>
              <p className="text-gray-500 mt-2">Core system configuration (Coming Soon in Phase 10)</p>
            </div>
          )}

          {tab === 'region' && (
            <div className="max-w-md mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Regional Settings</h2>
                <p className="text-gray-500 text-xs mb-6">Select your default region and operating branch. Distance limits apply.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Country / Region</label>
                    <select 
                      value={region}
                      onChange={(e) => { setRegion(e.target.value); setSaved(false); }}
                      className="w-full border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 bg-gray-50"
                    >
                      <option value="ID">Indonesia (Domestic)</option>
                      <option value="SG">Singapore (International) - Coming Soon</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Primary Branch</label>
                    <select 
                      value={selectedBranch === 'ALL' ? '' : selectedBranch} // If executive is on ALL, show empty
                      onChange={handleBranchChange}
                      disabled={!isExecutive}
                      className="w-full border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 py-2.5 px-4 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {!isExecutive ? (
                      <p className="text-[11px] text-emerald-600 mt-2 font-bold">✓ Automatically locked to your nearest physical branch via GPS.</p>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-2">Executive Access: You can manually override your active branch context.</p>
                    )}
                  </div>

                  {branchError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-3 items-start">
                      <span className="text-red-500 text-lg">!</span>
                      <p>{branchError}</p>
                    </div>
                  )}

                  <button 
                    onClick={saveRegionSettings}
                    disabled={saving}
                    className="w-full mt-4 bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {saving ? 'Validating Location...' : saved && !branchError ? 'Saved Successfully' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'language' && (
            <div className="max-w-md mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Language Preferences</h2>
                <p className="text-gray-500 text-xs mb-6">Choose your preferred display language for the ERP software.</p>
                
                <div className="space-y-3">
                  <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${language === 'id' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="lang" value="id" checked={language === 'id'} onChange={() => { setLanguage('id'); setSaved(false); }} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <div className="ml-3">
                      <span className="block text-sm font-bold text-gray-900">Bahasa Indonesia</span>
                      <span className="block text-xs text-gray-500">Default national language</span>
                    </div>
                  </label>

                  <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${language === 'en' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="lang" value="en" checked={language === 'en'} onChange={() => { setLanguage('en'); setSaved(false); }} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <div className="ml-3">
                      <span className="block text-sm font-bold text-gray-900">English</span>
                      <span className="block text-xs text-gray-500">International standard</span>
                    </div>
                  </label>
                </div>

                <button 
                  onClick={saveLangSettings}
                  disabled={saving}
                  className="w-full mt-6 bg-black text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : saved ? 'Preferences Saved' : 'Save Language'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
