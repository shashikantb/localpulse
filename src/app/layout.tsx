
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import Footer from '@/components/layout/footer'; // Import Footer

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
    <html lang="en" className="h-full"> {/* Ensure html takes full height */}
      <body className={`${geistSans.variable} antialiased bg-background text-foreground flex flex-col min-h-screen`}> {/* Use flex-col and min-h-screen */}
        <div className="flex-grow"> {/* Main content wrapper that grows */}
          {children}
        </div>
        <Footer /> {/* Add Footer component */}
        <Toaster /> {/* Add Toaster for notifications globally */}
      </body>
    </html>
  );
}
