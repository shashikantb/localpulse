
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Footer from '@/components/layout/footer';
import BottomNavBar from '@/components/layout/bottom-nav-bar';
import { AppInstallPrompt } from '@/components/app-install-prompt';
import Header from '@/components/layout/header';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LocalPulse',
  description: 'Share and discover what\'s happening around you',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Next.js will populate this head based on metadata and other conventions */}
      </head>
      <body className={`${geistSans.variable} antialiased bg-background text-foreground flex flex-col min-h-screen`}>
        <Header />
        <div className="flex-grow pb-16 sm:pb-0"> {/* Add padding-bottom for mobile, remove for sm and up */}
          {children}
        </div>
        <Footer />
        <BottomNavBar /> {/* Add BottomNavBar here */}
        <AppInstallPrompt />
        <Toaster />
      </body>
    </html>
  );
}
