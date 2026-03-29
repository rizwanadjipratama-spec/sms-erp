'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useCmsSection } from '@/hooks/useCms';

export default function Hero() {
  const { section } = useCmsSection('hero');

  const title = section?.title || 'Precision Laboratory Systems\nBuilt for Real Operations';
  const subtitle = section?.subtitle || 'Equipment, reagents, and technical support for laboratories across Indonesia.';
  const videoUrl = section?.video_url || '/videos/hero.mp4';
  const ctaText = section?.cta_text || 'Explore Products';
  const ctaLink = section?.cta_link || '/products';

  return (
    <section className="relative w-full h-screen overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={videoUrl} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 1 }}
          transition={{ duration: 0.6 }}
          className="text-white text-4xl md:text-6xl font-semibold tracking-tight max-w-4xl leading-[1.05] whitespace-pre-line"
          style={{ color: '#ffffff' }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mt-6 text-base md:text-lg max-w-xl leading-relaxed text-white"
          style={{ color: '#ffffff' }}
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link
            href={ctaLink}
            className="px-6 py-3 bg-blue-600 text-white text-sm rounded-full hover:bg-blue-700 transition"
          >
            {ctaText}
          </Link>

          <Link
            href="#contact"
            className="px-6 py-3 bg-white/90 text-gray-900 text-sm rounded-full hover:bg-white transition"
          >
            Contact Us
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
