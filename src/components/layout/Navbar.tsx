'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/ui/NotificationBell';
import BranchIndicator from '@/components/layout/BranchIndicator';

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center h-16 lg:h-20">  

          {/* LEFT: LOGO */}
          <div className="flex-1 flex items-center">
            <Link href="/" className="text-2xl font-black text-[var(--apple-text-primary)] tracking-tighter">
              ORION
            </Link>
          </div>

          {/* CENTER: MENU TENGAH */}
          <div className="flex-1 hidden md:flex items-center justify-center gap-10">
            <Link href="/about" className="text-sm font-bold text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] transition-colors">
              About
            </Link>
            <Link href="/dashboard/client/products" className="text-sm font-bold text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] transition-colors">
              Products
            </Link>
            <Link href="/services" className="text-sm font-bold text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] transition-colors">
              Services
            </Link>
            <Link href="/contact" className="text-sm font-bold text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] transition-colors">
              Contact
            </Link>
          </div>

          {/* RIGHT: NOTIFICATION + PROFILE PIC */}
          <div className="flex-1 flex items-center justify-end gap-3">
            {authLoading ? (
              /* Skeleton while auth is resolving */
              <div className="flex items-center gap-3">
                <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
              </div>
            ) : profile ? (
              <>
                {/* 📍 Multi-Branch Context Switcher / Indicator */}
                <BranchIndicator />

                {/* 🔔 Notification Bell */}
                <NotificationBell />

                {/* Profile Pic & Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[var(--apple-blue)] to-blue-600 text-white font-black text-sm uppercase shadow-sm hover:scale-105 transition-transform ring-2 ring-transparent hover:ring-[var(--apple-blue)]/30 ring-offset-2"
                  >
                    {profile.name?.[0] || profile.email?.[0] || '?'}
                  </button>

                  {/* Profile Dropdown */}
                  <AnimatePresence>
                  {profileOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[var(--apple-border)] py-2 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-[var(--apple-border)] bg-[var(--apple-gray-bg)]/50">
                        <p className="text-sm font-bold text-[var(--apple-text-primary)] truncate">{profile.name || profile.email}</p>
                        <p className="text-[10px] font-black tracking-wider text-[var(--apple-text-tertiary)] uppercase mt-0.5">{profile.role}</p>
                      </div>
                      
                      <div className="py-1">
                        <Link href="/dashboard" onClick={() => setProfileOpen(false)} className="block px-4 py-2.5 text-sm font-bold text-[var(--apple-text-primary)] hover:bg-[var(--apple-gray-bg)] transition-colors">Dashboard</Link>
                        <Link href="/dashboard/settings" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-[var(--apple-gray-bg)] transition-colors">Settings</Link>
                        <Link href="/dashboard/settings?tab=region" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-[var(--apple-gray-bg)] transition-colors">Region / Branch</Link>
                        <Link href="/dashboard/settings?tab=language" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-[var(--apple-gray-bg)] transition-colors">Language</Link>
                        <Link href="/dashboard/notifications" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-[var(--apple-gray-bg)] transition-colors">Notifications</Link>
                        <Link href="/help" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-[var(--apple-gray-bg)] transition-colors">Help</Link>
                      </div>
                      
                      <div className="border-t border-[var(--apple-border)] py-1 mt-1">
                        <button
                          onClick={() => { setProfileOpen(false); handleLogout(); }}
                          className="w-full text-left px-4 py-2.5 text-sm font-bold text-[var(--apple-danger)] hover:bg-red-50 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-95 shadow-sm"
              >
                Get Started
              </Link>
            )}

            {/* Mobile menu btn */}
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden relative w-10 h-10 flex items-center justify-center bg-[var(--apple-gray-bg)] rounded-full ml-1"
            >
              <span className={`absolute h-[2px] w-4 bg-[var(--apple-text-primary)] transition-all ${mobileOpen ? 'rotate-45' : '-translate-y-1.5'}`} />
              <span className={`absolute h-[2px] w-4 bg-[var(--apple-text-primary)] transition-all ${mobileOpen ? '-rotate-45' : 'translate-y-1.5'}`} />
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-[var(--apple-border)] overflow-hidden"
          >
            <div className="px-6 py-6 space-y-4">
              <Link href="/about" onClick={() => setMobileOpen(false)} className="block text-[var(--apple-text-primary)] font-bold text-lg">About</Link>
              <Link href="/dashboard/client/products" onClick={() => setMobileOpen(false)} className="block text-[var(--apple-text-primary)] font-bold text-lg">Products</Link>
              <Link href="/services" onClick={() => setMobileOpen(false)} className="block text-[var(--apple-text-primary)] font-bold text-lg">Services</Link>
              <Link href="/contact" onClick={() => setMobileOpen(false)} className="block text-[var(--apple-text-primary)] font-bold text-lg">Contact</Link>
              
              {profile && (
                <div className="pt-6 border-t border-[var(--apple-border)] mt-4">
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block text-[var(--apple-blue)] font-black text-lg">
                    Go to Dashboard →
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;