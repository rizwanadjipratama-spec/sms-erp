'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types/types';
import { productService } from '@/lib/product-service';
import { ProductList } from '@/components/dashboard/ProductList';
import { useRequest } from '@/lib/request-context';
import { useRouter } from 'next/navigation';

export default function ClientProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { add } = useRequest();
  const router = useRouter();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await productService.fetchProducts(true);
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    add(product.id);
    // Optional: show a toast or feedback
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-apple-text-primary tracking-tight">Browse Products</h1>
          <p className="text-apple-text-secondary text-sm mt-1 font-medium">Select items to add to your new request.</p>
        </div>
        <button 
          onClick={() => router.push('/request')}
          className="bg-apple-text-primary hover:bg-black text-white text-[10px] font-black px-6 py-2.5 rounded-apple transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
        >
          VIEW REQUEST CART
        </button>
      </div>

      <div className="relative group max-w-md">
        <input 
          type="text" 
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-apple-gray-bg border border-apple-gray-border rounded-xl px-10 py-2.5 text-sm focus:ring-4 focus:ring-apple-blue/10 focus:border-apple-blue outline-none transition-all font-medium"
        />
        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-apple-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-apple-text-secondary text-xs font-bold uppercase tracking-widest">Loading Catalog...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-apple-gray-bg/50 border border-apple-gray-border rounded-3xl p-16 text-center">
           <p className="text-apple-text-secondary text-sm font-bold">No products available at the moment.</p>
        </div>
      ) : (
        <ProductList 
          products={filteredProducts} 
          onAddToCart={handleAddToCart}
          isAdmin={false}
        />
      )}
    </div>
  );
}
