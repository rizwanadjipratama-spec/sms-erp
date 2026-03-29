'use client';

import { useState, useEffect } from 'react';
import { productService } from '@/lib/services';
import { useRequest } from '@/lib/request-context';
import type { Product } from '@/types/types';

export default function ProductsPage() {
  const { add } = useRequest();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.getActive()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
          Products
        </h1>
        <p className="text-gray-600 mt-2">
          Explore our laboratory equipment and reagents.
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-10">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No products available at the moment.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-10">
          {products
            .filter((p) => p.stock > 0)
            .map((p) => (
              <div key={p.id} className="group">
                <div className="h-40 flex items-center justify-center mb-4">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="max-h-full object-contain group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-2xl" />
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-1">{p.category}</p>

                <h3 className="text-lg font-semibold text-gray-900">
                  {p.name}
                </h3>

                <div className="flex gap-4 mt-3 text-sm">
                  <button
                    onClick={() => add(p.id)}
                    className="text-blue-600 hover:underline"
                  >
                    Add to Request
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
