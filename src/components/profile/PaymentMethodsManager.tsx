'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserPaymentMethod } from '@/types/types';

export function PaymentMethodsManager({ profileId }: { profileId: string }) {
  const [methods, setMethods] = useState<UserPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'BANK' | 'EWALLET'>('BANK');
  const [provider, setProvider] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMethods();
  }, [profileId]);

  const fetchMethods = async () => {
    if (!profileId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });
        
      if (error) throw new Error(error.message || 'Failed to load payment methods');
      setMethods(data || []);
    } catch (err: unknown) {
      // Silently handle — payment methods are optional
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!provider || !accountNumber || !accountName) {
      alert('Tolong isi semua field');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('user_payment_methods').insert([{
        user_id: profileId,
        type,
        provider,
        account_number: accountNumber,
        account_name: accountName
      } as any]);

      if (error) throw error;
      
      setShowForm(false);
      setProvider('');
      setAccountNumber('');
      setAccountName('');
      await fetchMethods();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus rekening/akun ini?')) return;
    try {
      const { error } = await supabase.from('user_payment_methods').delete().eq('id', id);
      if (error) throw error;
      setMethods(methods.filter(m => m.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="mt-10 pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Metode Pembayaran Tersimpan</h3>
          <p className="text-sm text-gray-500 font-medium">Rekening atau E-Wallet untuk pencairan Claim/Reimburse.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-apple-blue/10 text-apple-blue font-bold rounded-xl text-xs hover:bg-apple-blue/20 transition-all"
        >
          {showForm ? 'Batal' : '+ Tambah Rekening'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Jenis</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none"
              >
                <option value="BANK">Bank Transfer</option>
                <option value="EWALLET">E-Wallet (Dana, OVO, Gopay, dll)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nama {type === 'BANK' ? 'Bank' : 'E-Wallet'}</label>
              <input 
                type="text" 
                placeholder={type === 'BANK' ? 'BCA, Mandiri, BNI...' : 'Dana, GoPay, OVO...'}
                value={provider}
                onChange={e => setProvider(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nomor Rekening / HP</label>
              <input 
                type="text" 
                placeholder="081234..."
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Atas Nama</label>
              <input 
                type="text" 
                placeholder="Nama Pemilik Akun"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-apple-blue text-white font-bold rounded-xl text-sm shadow-md shadow-apple-blue/30 hover:bg-apple-blue-hover disabled:bg-gray-400 transition-all"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse bg-gray-100 h-24 rounded-2xl w-full"></div>
      ) : methods.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
          <p className="text-gray-500 text-sm font-medium">Belum ada metode pembayaran tersimpan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {methods.map(m => (
            <div key={m.id} className="relative group bg-white border border-gray-200 shadow-sm rounded-2xl p-4 hover:shadow-md transition-all">
              <button 
                onClick={() => handleDelete(m.id)}
                className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                title="Hapus"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${m.type === 'BANK' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {m.type === 'BANK' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{m.type === 'BANK' ? 'Bank Transfer' : 'E-Wallet'}</p>
                  <p className="text-base font-black text-gray-900">{m.provider}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-gray-900 font-mono tracking-wider font-bold mb-0.5">{m.account_number}</p>
                <p className="text-xs text-gray-500 font-medium">a/n <span className="text-gray-700">{m.account_name}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
