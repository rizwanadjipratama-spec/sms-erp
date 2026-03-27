'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative w-full h-screen overflow-hidden">

      {/* VIDEO */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* OVERLAY (FIX TOTAL) */}
      <div className="absolute inset-0 bg-black/60" />

      {/* CONTENT */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-6">

        {/* TITLE */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 1 }}
          transition={{ duration: 0.6 }}
          className="text-white text-4xl md:text-6xl font-semibold tracking-tight max-w-4xl leading-[1.05]"
          style={{ color: '#ffffff' }}
        >
          Precision Laboratory Systems
          <br />
          Built for Real Operations
        </motion.h1>

        {/* SUBTEXT */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mt-6 text-base md:text-lg max-w-xl leading-relaxed text-white"
          style={{ color: '#ffffff' }}
        >
          Equipment, reagents, and technical support for laboratories across Indonesia.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/products"
            className="px-6 py-3 bg-blue-600 text-white text-sm rounded-full hover:bg-blue-700 transition"
          >
            Explore Products
          </Link>

          <Link
            href="/contact"
            className="px-6 py-3 bg-white/90 text-gray-900 text-sm rounded-full hover:bg-white transition"
          >
            Contact Us
          </Link>
        </motion.div>

      </div>

    </section>
  );
}