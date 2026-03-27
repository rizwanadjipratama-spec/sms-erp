'use client';

import { useState, useEffect } from 'react';
import { getProducts } from '@/lib/data';
import { useRequest } from '@/lib/request-context';
import { Product } from '@/types/types';

export default function ProductsPage() {
  const { add } = useRequest();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const data = await getProducts();
      setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
          Products
        </h1>
        <p className="text-gray-600 mt-2">
          Explore our laboratory equipment and reagents.
        </p>
      </div>

      {/* GRID */}
      {loading ? (
        <div className="text-center">Loading products...</div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-10">
          {products
            .filter((p) => p.stock > 0)
            .map((p) => (
              <div key={p.id} className="group">
                {/* IMAGE */}
                <div className="h-40 flex items-center justify-center mb-4">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="max-h-full object-contain group-hover:scale-105 transition"
                  />
                </div>

                {/* CATEGORY */}
                <p className="text-xs text-gray-500 mb-1">{p.category}</p>

                {/* NAME */}
                <h3 className="text-lg font-semibold text-gray-900">
                  {p.name}
                </h3>

                {/* ACTION */}
                <div className="flex gap-4 mt-3 text-sm">
                  <button
                    onClick={() => add(p.id)}
                    className="text-blue-600 hover:underline"
                  >
                    Add to Request
                  </button>

                  <button className="text-gray-500 hover:text-blue-600">
                    Details
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}