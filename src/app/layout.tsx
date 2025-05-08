
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

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
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
        {/* The main tag is removed from here to allow admin layout to take full screen */}
        {children}
        <Toaster /> {/* Add Toaster for notifications globally */}
      </body>
    </html>
  );
}
