'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useCmsSolutions, useCmsSection } from '@/hooks/useCms';
import { solutions as fallbackSolutions } from '@/lib/data';

export default function Solutions() {
  const { solutions: cmsSolutions, loading } = useCmsSolutions();
  const { section } = useCmsSection('services');

  const title = section?.title || 'Complete Laboratory Solutions';
  const subtitle = section?.subtitle || 'From equipment to consumables to full-service support — everything your lab needs to operate reliably.';

  // Use CMS data if available, otherwise fall back to static data
  const displaySolutions = cmsSolutions.length > 0
    ? cmsSolutions.map((s) => ({
        slug: s.slug,
        title: s.title,
        description: s.description || '',
        category: s.category || '',
        image: s.image_url || '/products/default.png',
        specs: s.specs,
        useCase: s.use_case || '',
      }))
    : fallbackSolutions;

  return (
    <section id="solutions" className="py-32 px-4 sm:px-6 lg:px-8 bg-gray-50/50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-24"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            {title}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displaySolutions.map((solution, index) => (
              <motion.div
                key={solution.slug}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -8 }}
                className="group bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-gray-200"
              >
                <div className="h-48 lg:h-56 overflow-hidden bg-gray-100 relative">
                  <Image
                    src={solution.image}
                    alt={solution.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-8">
                  <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mb-4">
                    {solution.category}
                  </span>
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-blue-600 transition-colors duration-300">
                    {solution.title}
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {solution.description}
                  </p>
                  <Link
                    href={`/solution/${solution.slug}`}
                    className="text-blue-600 hover:text-blue-700 font-medium text-lg flex items-center group-hover:translate-x-2 transition-all duration-300"
                  >
                    Learn More →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
