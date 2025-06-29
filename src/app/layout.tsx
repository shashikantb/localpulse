
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Footer from '@/components/layout/footer';
import { AppInstallPrompt } from '@/components/app-install-prompt';
import Header from '@/components/layout/header';
import dynamic from 'next/dynamic';

const BottomNavBar = dynamic(() => import('@/components/layout/bottom-nav-bar'), {
  // No loading skeleton needed as it's invisible on desktop and loads after hydration on mobile.
  loading: () => null, 
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LocalPulse',
  description: 'Share and discover what\'s happening around you',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This component is now static and does not fetch the session.
  // This allows Next.js to cache the page shell, improving performance.

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="UTF-8" />
        {/* Next.js will populate this head based on metadata and other conventions */}
      </head>
      <body className={`${geistSans.variable} antialiased bg-background text-foreground flex flex-col min-h-screen`}>
        <Header />
        <div className="flex-grow pb-16 sm:pb-0"> {/* Add padding-bottom for mobile, remove for sm and up */}
          {children}
        </div>
        <Footer />
        <BottomNavBar />
        <AppInstallPrompt />
        <Toaster />
      </body>
    </html>
  );
}
