'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/permissions';
import { authService } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { purchaseRequestsDb } from '@/lib/db';
import type { Product } from '@/types/types';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';

function RequestPurchaseContent() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('product_id');

  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{
    product_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    estimated_price: number;
  }>>([]);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
    if (!authLoading && profile && !canAccessRoute(profile, '/dashboard/warehouse/request-purchase')) {
      router.replace(authService.getRoleRedirect(profile.role));
    }
  }, [authLoading, profile, router]);

  const loadProducts = useCallback(async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      setProducts(data as Product[]);

      // Auto-fill from query param
      if (initialProductId) {
        const prod = (data as Product[]).find(p => p.id === initialProductId);
        if (prod) {
          setTitle(`Restock Request: ${prod.name}`);
          setItems([{
            product_id: prod.id,
            item_name: prod.name,
            quantity: 10,
            unit: prod.unit || 'pcs',
            estimated_price: 0
          }]);
        }
      } else {
        // Empty row
        setItems([{ product_id: '', item_name: '', quantity: 1, unit: 'pcs', estimated_price: 0 }]);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setFetching(false);
    }
  }, [initialProductId]);

  useEffect(() => {
    if (profile) loadProducts();
  }, [profile, loadProducts]);

  const handleProductChange = (index: number, productId: string) => {
    const newItems = [...items];
    const prod = products.find(p => p.id === productId);
    if (prod) {
      newItems[index] = {
        ...newItems[index],
        product_id: prod.id,
        item_name: prod.name,
        unit: prod.unit || 'pcs'
      };
    } else {
      // Free text entry
      newItems[index] = {
        ...newItems[index],
        product_id: '',
        item_name: '',
        unit: 'pcs'
      };
    }
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { product_id: '', item_name: '', quantity: 1, unit: 'pcs', estimated_price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.branch_id) return alert('No branch assigned to profile.');
    if (items.some(i => !i.item_name.trim() || i.quantity <= 0)) {
      return alert('Mohon lengkapi semua baris item (nama barang & kuantitas).');
    }

    setSubmitting(true);
    try {
      const totalEstimated = items.reduce((sum, item) => sum + (item.quantity * item.estimated_price), 0);
      
      // Create Header
      const pr = await purchaseRequestsDb.create({
        branch_id: profile.branch_id,
        requested_by: profile.id,
        title: title || 'Procurement Request',
        notes: notes || undefined,
        total_estimated: totalEstimated
      });

      // Create Items
      const itemsToInsert = items.map(item => ({
        purchase_request_id: pr.id,
        product_id: item.product_id || null,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        estimated_price: item.estimated_price
      }));

      const { error: itemsError } = await supabase.from('purchase_request_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert('Procurement request submitted successfully! Menunggu approval dari Supervisor.');
      router.push('/dashboard/warehouse/inventory');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error submitting request');
      setSubmitting(false);
    }
  };

  if (authLoading || fetching) return <div className="p-4 mx-auto max-w-4xl"><DashboardSkeleton /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500 p-4">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Create Purchase Request</h1>
        <p className="text-gray-500 font-medium mt-1">Request new stock logically. It will be sent to supervisors for approval.</p>
      </div>

      <form onSubmit={handleSubmit} className="apple-card p-6 md:p-8 space-y-8 bg-white border border-gray-200">
        
        {/* Header Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Request Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-gray-700">Request Title <span className="text-red-500">*</span></label>
              <input 
                type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Restock Reagent & Lab Tubes"
                className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-gray-700">Additional Notes</label>
              <textarea 
                rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Alasan pembelian, nama supplier incaran, dll..."
                className="w-full text-sm rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Items Requested</h2>
            <button type="button" onClick={addItem} className="text-xs font-bold text-blue-600 hover:text-blue-700">+ Add Row</button>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-start p-4 border border-gray-100 bg-gray-50/50 rounded-xl">
                {/* Catalog Select */}
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] uppercase font-bold text-gray-500">From Catalog (Optional)</label>
                  <select 
                    value={item.product_id} 
                    onChange={e => handleProductChange(index, e.target.value)}
                    className="w-full text-sm rounded-lg border-gray-200 px-3 py-2 bg-white"
                  >
                    <option value="">-- Free Text Item --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Free Text Name */}
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Item Name <span className="text-red-500">*</span></label>
                  <input 
                    type="text" required value={item.item_name}
                    onChange={e => {
                      const newItems = [...items];
                      newItems[index].item_name = e.target.value;
                      setItems(newItems);
                    }}
                    placeholder="Nama barang..."
                    className="w-full text-sm rounded-lg border-gray-200 px-3 py-2 bg-white"
                  />
                </div>

                {/* Qty & Unit */}
                <div className="w-full md:w-32 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Qty <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <input 
                      type="number" min="1" required value={item.quantity || ''}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].quantity = parseInt(e.target.value) || 0;
                        setItems(newItems);
                      }}
                      className="w-16 text-sm rounded-lg border-gray-200 px-2 py-2 bg-white text-center"
                    />
                    <input 
                      type="text" value={item.unit}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].unit = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-12 text-sm rounded-lg border-gray-200 px-2 py-2 bg-white text-center"
                    />
                  </div>
                </div>

                {/* Estimated Price */}
                <div className="w-full md:w-40 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Est. Price/Item</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">Rp</span>
                    <input 
                      type="number" min="0" value={item.estimated_price || ''}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].estimated_price = parseInt(e.target.value) || 0;
                        setItems(newItems);
                      }}
                      placeholder="0"
                      className="w-full text-sm rounded-lg border-gray-200 pl-8 pr-3 py-2 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="button" onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
          <button 
            type="button" onClick={() => router.back()}
            className="px-6 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" disabled={submitting}
            className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RequestPurchasePage() {
  return (
    <Suspense fallback={<div className="p-4 mx-auto max-w-4xl"><DashboardSkeleton /></div>}>
      <RequestPurchaseContent />
    </Suspense>
  );
}
