import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './layout.css';
import RequestProvider from '@/lib/request-context';
import { AuthProvider } from '@/hooks/useAuth';
import AnnouncementBanner from '@/components/layout/AnnouncementBanner';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'SMS Laboratory Systems - Precision Support for Indonesian Laboratories',
  description:
    'Supplying, supporting, and sustaining laboratory equipment across Indonesia. Hematology, Chemistry, POCT systems with 24/7 service.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className={`${inter.variable} antialiased bg-white text-gray-900`}>
      <AuthProvider>
        <AnnouncementBanner />
        <RequestProvider>
          {children}
        </RequestProvider>
      </AuthProvider>
      </body>
    </html>
  );
}