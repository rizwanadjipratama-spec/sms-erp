'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { productService } from '@/lib/services';
import type { Product } from '@/types/types';

export default function ProductHighlight() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.getActive()
      .then((data) => setProducts(data.slice(0, 4)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="w-full h-80 bg-gray-50 animate-pulse" />;
  }

  if (products.length === 0) return null;

  return (
    <section className="w-full bg-white">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-6">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Featured Products
            </h2>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              Explore our most trusted laboratory equipment and reagents used by healthcare facilities across Indonesia.
            </p>
          </div>
          <Link
            href="/products"
            className="text-sm text-blue-600 hover:underline"
          >
            View all products →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="h-32 flex items-center justify-center mb-4">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="max-h-full object-contain group-hover:scale-105 transition duration-200"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-1">{p.category}</p>

              <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition">
                {p.name}
              </h3>

              <div className="mt-3 flex gap-3 text-xs text-gray-500">
                <Link href="/products" className="hover:text-blue-600">
                  Details
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
