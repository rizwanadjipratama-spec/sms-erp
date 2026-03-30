'use client'

import Link from "next/link"
import { useState, useEffect } from 'react';
import { cmsService } from '@/lib/services';
import type { CmsSettings } from '@/types/types';

export default function Footer() {
  const [settings, setSettings] = useState<CmsSettings | null>(null);

  useEffect(() => {
    cmsService.getSettings().then(setSettings).catch(() => null);
  }, []);

  const companyName = settings?.company_name || 'Sarana Megamedilab Sejahtera';
  const companyDesc = settings?.company_address || 'Penyedia alat laboratorium medis, reagent, dan layanan teknisi 24/7\nuntuk rumah sakit dan klinik di Indonesia.';

  return (
    <footer className="w-full border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">

        {/* TOP */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* LEFT */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {companyName}
            </h2>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-sm whitespace-pre-line">
              {companyDesc}
            </p>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Company
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><Link href="#about" className="hover:text-blue-600">About</Link></li>
                <li><Link href="#contact" className="hover:text-blue-600">Contact</Link></li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Solutions
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><Link href="#">Hematology</Link></li>
                <li><Link href="#">Chemistry Analyzer</Link></li>
                <li><Link href="#">POCT</Link></li>
                <li><Link href="#">Reagents</Link></li>
              </ul>
            </div>

            {/* Locations */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Locations
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li>Bogor</li>
                <li>Cirebon</li>
                <li>Purwokerto</li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Support
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li>24/7 Technician</li>
                <li>On-site Service</li>
                <li>Installation</li>
              </ul>
            </div>

          </div>
        </div>

        {/* DIVIDER */}
        <div className="mt-16 border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 gap-4">

          <p className="text-center md:text-left">
            © {new Date().getFullYear()} Sarana Megamedilab Sejahtera. All rights reserved.
          </p>

          <div className="flex gap-6">
            <Link href="#" className="hover:text-blue-600">Privacy</Link>
            <Link href="#" className="hover:text-blue-600">Terms</Link>
          </div>

        </div>
      </div>
    </footer>
  )
}