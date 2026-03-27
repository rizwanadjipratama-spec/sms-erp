'use client';

import { motion } from 'framer-motion';

const values = [
  {
    title: 'Produk IVD Berkualitas',
    desc: 'Perangkat dan reagen dari brand terpercaya dan teruji.',
  },
  {
    title: 'Distribusi Cepat & Tepat',
    desc: 'Jaringan distribusi luas ke seluruh Indonesia.',
  },
  {
    title: 'Teknisi 24/7',
    desc: 'Dukungan teknis responsif kapan saja dibutuhkan.',
  },
  {
    title: 'KSO Fleksibel',
    desc: 'Skema kerja sama tanpa investasi awal.',
  },
];

export default function ValueStrip() {
  return (
    <section className="w-full bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-10">

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">

          {values.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="text-center md:text-left"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                {item.title}
              </h3>

              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}

        </div>

      </div>
    </section>
  );
}