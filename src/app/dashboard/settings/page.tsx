'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { autoApproveService } from '@/lib/services/auto-approve-service';
import type { AutoApproveSettings } from '@/lib/services/auto-approve-service';
import { useEffect, useCallback } from 'react';

function AutoApproveSettingsTab({ branchId }: { branchId: string }) {
  const [settings, setSettings] = useState<AutoApproveSettings>({
    auto_approve_enabled: false,
    auto_approve_min_spend: 5000000,
    auto_approve_default_limit: 500000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    try {
      const data = await autoApproveService.getSettings(branchId);
      setSettings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await autoApproveService.updateSettings(branchId, settings);
      setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm font-medium animate-pulse">Loading automation settings...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Background Automatic Approvals</h2>
        <p className="text-gray-500 text-xs mb-6 max-w-prose">
          When activated, the system automatically runs a background check on incoming client requests. 
          If the client's projected debt exceeds their limit, it auto-rejects. If it's within the limit and they have sufficient lifetime spend, it auto-approves. Otherwise, it is sent to the manual queue.
        </p>
        
        <div className="space-y-5">
          <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${settings.auto_approve_enabled ? 'border-apple-blue bg-blue-50/30 ring-1 ring-apple-blue/20' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input 
              type="checkbox" 
              checked={settings.auto_approve_enabled} 
              onChange={(e) => { setSettings(s => ({ ...s, auto_approve_enabled: e.target.checked })); setSaved(false); }} 
              className="w-5 h-5 text-apple-blue border-gray-300 rounded focus:ring-apple-blue" 
            />
            <div className="ml-4">
              <span className="block text-sm font-bold text-gray-900">Enable Auto Mode</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">Automata engine runs on all incoming priced orders.</span>
            </div>
            {settings.auto_approve_enabled && (
              <span className="ml-auto inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 animate-pulse">ACTIVE & LISTENING</span>
            )}
          </label>

          <div className={`space-y-4 transition-all duration-300 ${settings.auto_approve_enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="bg-gray-50 border border-gray-100 p-5 rounded-2xl space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Minimum Lifetime Spend to Qualify (Rp)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium text-sm">Rp</span>
                  <input 
                    type="number" 
                    value={settings.auto_approve_min_spend}
                    onChange={(e) => { setSettings(s => ({ ...s, auto_approve_min_spend: Number(e.target.value) })); setSaved(false); }}
                    className="w-full border border-gray-200 rounded-xl focus:ring-apple-blue focus:border-apple-blue py-2.5 pl-10 pr-4 bg-white font-medium text-gray-900"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 ml-1">New customers below this spend threshold will always require manual approval.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Default Unverified Debt Limit (Rp)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium text-sm">Rp</span>
                  <input 
                    type="number" 
                    value={settings.auto_approve_default_limit}
                    onChange={(e) => { setSettings(s => ({ ...s, auto_approve_default_limit: Number(e.target.value) })); setSaved(false); }}
                    className="w-full border border-gray-200 rounded-xl focus:ring-apple-blue focus:border-apple-blue py-2.5 pl-10 pr-4 bg-white font-medium text-gray-900"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Debt limit applied to clients who do not have a configured personal debt limit yet.</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-6 bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Synchronizing Automata engine...' : saved ? 'Rules Updated Successfully' : 'Apply Pipeline Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
          <a href="?tab=general" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'general' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>General</a>
          <a href="?tab=region" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'region' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Region / Branch</a>
          <a href="?tab=language" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'language' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Language</a>
          {isExecutive && (
            <a href="?tab=automation" className={`px-6 py-4 font-bold border-b-2 transition-colors ${tab === 'automation' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>Automation & Approvals</a>
          )}
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

          {tab === 'automation' && isExecutive && (
            <AutoApproveSettingsTab branchId={selectedBranch === 'ALL' ? activeBranchId : selectedBranch} />
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
