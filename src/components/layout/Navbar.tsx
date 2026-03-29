'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { solutions } from '@/lib/data';
import { useRequest } from '@/lib/request-context';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

type MenuType = null | 'solutions' | 'discover' | 'products';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const { itemCount } = useRequest();
  const { profile, logout, loading } = useAuth();
  const router = useRouter();

  const requestCount = itemCount;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const openMenu = (menu: MenuType) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menu);
  };

  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 120);
  };

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  const solutionNames = solutions.slice(0, 5).map((s) => s.title);

  const discoverItems = [
    'About',
    'Why SMS',
    'Clients',
    'Locations',
    'Careers',
    'News',
  ];

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center h-4 lg:h-6">  

          {/* LEFT */}
          <div className="flex-1 flex items-center">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              SMS
            </Link>
          </div>
        </div>

          {/* CENTER */}
          <div className="flex-1 hidden md:flex items-center justify-center gap-10">

            <div
              onMouseEnter={() => openMenu('solutions')}
              onMouseLeave={closeMenu}
            >
              <button className="text-sm font-medium text-gray-700 hover:text-blue-600">
                Solutions
              </button>
            </div>

            <div
              onMouseEnter={() => openMenu('discover')}
              onMouseLeave={closeMenu}
            >
              <button className="text-sm font-medium text-gray-700 hover:text-blue-600">
                Discover
              </button>
            </div>

            <div
              onMouseEnter={() => openMenu('products')}
              onMouseLeave={closeMenu}
            >
              <button className="text-sm font-medium text-gray-700 hover:text-blue-600">
                Products
              </button>
            </div>

            <Link
              href="/contact"
              className="text-sm font-medium text-gray-700 hover:text-blue-600"
            >
              Contact
            </Link>

          </div>

          {/* RIGHT */}
          <div className="flex-1 flex items-center justify-end gap-4">

            {/* REQUEST + AUTH */}
            <div className="flex items-center gap-4">
              {/* Request */}
              <Link
                href="/request"
                className="hidden md:flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600"
              >
                Request
                {requestCount > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-[2px] rounded-full">
                    {requestCount}
                  </span>
                )}
              </Link>

              {/* Auth */}
              {profile ? (
                <div className="relative">
                  <button className="text-sm font-medium text-gray-700 hover:text-blue-600 flex items-center gap-1">
                    Account
                  </button>
                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <Link href="/request/history" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      My Requests
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  Login
                </Link>
              )}

              {/* Mobile menu btn */}
              <button
                onClick={() => setMobileOpen((prev) => !prev)}
                className="md:hidden relative w-8 h-8 flex items-center justify-center"
              >
                <span
                  className={`absolute h-[2px] w-5 bg-gray-900 transition ${
                    mobileOpen ? 'rotate-45' : '-translate-y-1.5'
                  }`}
                />
                <span
                  className={`absolute h-[2px] w-5 bg-gray-900 transition ${
                    mobileOpen ? '-rotate-45' : 'translate-y-1.5'
                  }`}
                />
              </button>

          </div>

        </div>
      </div>

      {/* 🔥 PANELS */}

      {/* SOLUTIONS */}
      <PanelWrapper
        isOpen={activeMenu === 'solutions'}
        open={() => openMenu('solutions')}
        close={closeMenu}
      >
        <PanelList
  columns={[
    {
      title: 'Solutions',
      items: [
        'Equipment',
        'Reagents',
        'Support Services',
        'Partnership (KSO)',
      ],
    },
  ]}
/>
      </PanelWrapper>

      {/* DISCOVER */}
      <PanelWrapper
        isOpen={activeMenu === 'discover'}
        open={() => openMenu('discover')}
        close={closeMenu}
      >
        <PanelList
  columns={[
    {
      title: 'Company',
      items: [
        'About',
        'Why SMS',
        'Clients',
        'Careers',
        'News',
      ],
    },
    {
      title: 'Locations',
      items: [
        'Bogor',
        'Cirebon',
        'Purwokerto',
      ],
    },
    {
      title: 'Resources',
      items: [
        'Contact',
        'Support',
      ],
    },
  ]}
/>
      </PanelWrapper>

      {/* PRODUCTS (VISUAL) */}
      <PanelWrapper
        isOpen={activeMenu === 'products'}
        open={() => openMenu('products')}
        close={closeMenu}
      >
        <ProductsPanel />
      </PanelWrapper>

      {/* MOBILE MENU */}
      <AnimatePresence>
  {mobileOpen && (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="md:hidden bg-white border-t border-gray-100"
    >
      <div className="px-6 py-6 space-y-6 text-sm">

        {/* MAIN NAV */}
        <div className="space-y-4">
          <Link href="/" className="block text-gray-900 font-medium">
            Home
          </Link>

          <Link href="/products" className="block text-gray-900 font-medium">
            Products
          </Link>

          <Link href="/contact" className="block text-gray-900 font-medium">
            Contact
          </Link>
        </div>

        {/* REQUEST */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-gray-900 font-medium">
            Request ({requestCount})
          </p>
        </div>

        {/* SOLUTIONS */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Solutions
          </p>

          <div className="space-y-2 text-gray-600">
            <div>Equipment</div>
            <div>Reagents</div>
            <div>Support Services</div>
            <div>Partnership (KSO)</div>
          </div>
        </div>

        {/* DISCOVER */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Discover
          </p>

          <div className="space-y-2 text-gray-600">
            <div>About</div>
            <div>Why SMS</div>
            <div>Clients</div>
            <div>Locations</div>
            <div>Careers</div>
            <div>News</div>
          </div>
        </div>

      </div>
    </motion.div>
  )}
</AnimatePresence>

    </motion.nav>
  );
};

export default Navbar;





/* ================= COMPONENTS ================= */

const PanelWrapper = ({
  isOpen,
  children,
  open,
  close,
}: {
  isOpen: boolean;
  children: React.ReactNode;
  open: () => void;
  close: () => void;
}) => (
  <div onMouseEnter={open} onMouseLeave={close}>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 bg-white border-b border-gray-100 z-50"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);



const PanelList = ({
  columns,
}: {
  columns: { title: string; items: string[] }[];
}) => (
  <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-10">

    {columns.map((col) => (
      <div key={col.title}>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          {col.title}
        </h3>

        <div className="space-y-3">
          {col.items.map((item) => (
            <div
              key={item}
              className="text-sm text-gray-600 hover:text-blue-600 cursor-pointer transition"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ))}

  </div>
);



const ProductsPanel = () => {
  const featured = [
    { name: 'Hematology Analyzer', image: '/products/hema.png' },
    { name: 'Chemistry Analyzer', image: '/products/chem.png' },
    { name: 'POCT Devices', image: '/products/poct.png' },
  ];

  const rightLinks = [
    'View All Products',
    'Reagents',
    'Equipment',
    'Support',
    'Partnership (KSO)',
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-[2fr_1fr] gap-10">

      {/* LEFT: PRODUCTS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 items-start">

        {featured.map((p) => (
          <div key={p.name} className="group text-center">

            {/* IMAGE (NO BACKGROUND) */}
            <div className="h-28 flex items-center justify-center mb-4">
              <img
                src={p.image}
                alt={p.name}
                className="max-h-full object-contain group-hover:scale-105 transition duration-200"
              />
            </div>

            {/* NAME */}
            <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition">
              {p.name}
            </p>

            {/* ACTIONS */}
            <div className="flex justify-center gap-3 mt-2 text-xs text-gray-500">
              <button className="hover:text-blue-600 transition">
                Add
              </button>
              <span>•</span>
              <button className="hover:text-blue-600 transition">
                Details
              </button>
            </div>

          </div>
        ))}

      </div>

      {/* RIGHT: LINKS */}
      <div className="border-l border-gray-200 pl-6 flex flex-col justify-start gap-3">

        {rightLinks.map((item) => (
          <div
            key={item}
            className="text-sm text-gray-600 hover:text-blue-600 cursor-pointer transition"
          >
            {item}
          </div>
        ))}

      </div>

    </div>
  );
};