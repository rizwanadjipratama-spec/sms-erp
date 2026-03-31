'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { productsDb } from '@/lib/db';
import { formatCurrency } from '@/lib/format-utils';
import type { Product } from '@/types/types';

export default function ProductHighlight() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch products with prices just like the dashboard
    productsDb.getAll({ onlyPriced: true })
      .then((res) => setProducts(res.data.slice(0, 4)))
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
            href="/dashboard/client/products"
            className="text-sm text-blue-600 hover:underline"
          >
            View all products →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {products.map((product, i) => {
            const price = product.price ? product.price.price_regular : null;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all hover:border-gray-200 hover:shadow-md"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                  {product.category && (
                    <span className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-700 backdrop-blur-sm">
                      {product.category}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-auto pt-3">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        {price !== null ? (
                          <>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(price)}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              per {product.unit || 'pcs'}
                            </p>
                          </>
                        ) : (
                          <p className="text-lg font-bold text-gray-900">-</p>
                        )}
                      </div>
                      <Link
                        href="/dashboard/client/products"
                        className="rounded-xl bg-gray-900 px-4 py-2 text-[11px] font-semibold text-white transition-all hover:bg-gray-800 active:scale-95"
                      >
                        View in Dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
