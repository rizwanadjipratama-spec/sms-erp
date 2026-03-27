'use client';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HomeSections from '@/components/sections/Home';

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <HomeSections />
      </main>

      <Footer />
    </>
  );
}