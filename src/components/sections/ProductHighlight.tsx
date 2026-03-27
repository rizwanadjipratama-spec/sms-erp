'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getProducts } from '@/lib/data';
import type { Product } from '@/types/types';

export default function ProductHighlight() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts().then((data) => {
      setProducts(data.slice(0, 4)); // Featured: first 4
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) {
    return <div className="w-full h-80 bg-gray-50 animate-pulse" />;
  }
  return (
    <section className="w-full bg-white">
      <div className="max-w-7xl mx-auto px-6 py-20">

        {/* HEADER */}
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

        {/* GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">

          {products.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group"
            >

              {/* IMAGE */}
              <div className="h-32 flex items-center justify-center mb-4">
                <img
                  src={p.image}
                  alt={p.name}
                  className="max-h-full object-contain group-hover:scale-105 transition duration-200"
                />
              </div>

              {/* CATEGORY */}
              <p className="text-xs text-gray-500 mb-1">
                {p.category}
              </p>

              {/* NAME */}
              <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition">
                {p.name}
              </h3>

              {/* ACTION */}
              <div className="mt-3 flex gap-3 text-xs text-gray-500">

                <button className="hover:text-blue-600 transition">
                  Add
                </button>

                <span>•</span>

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