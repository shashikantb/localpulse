
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import '@/app/globals.css';
import { Toaster } from '@/components/ui/toaster';
import Footer from '@/components/layout/footer';
import { AppInstallPrompt } from '@/components/app-install-prompt';
import Header from '@/components/layout/header';
import StickyNav from '@/components/sticky-nav';
import { Providers } from '@/app/providers';
import { getSession } from '@/app/auth/actions';
import { cookies } from 'next/headers';

// The geist font package exports an object with the variable name pre-configured.
// We just need to use it directly.

export const metadata: Metadata = {
  title: 'LocalPulse',
  description: 'Share and discover what\'s happening around you',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getSession();
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('user-auth-token');
  const nodeEnv = process.env.NODE_ENV;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        {/* Next.js will populate this head based on metadata and other conventions */}
      </head>
      <body className={`${GeistSans.variable} antialiased bg-background text-foreground flex flex-col min-h-svh`}>
        <div style={{
            backgroundColor: '#ffc',
            padding: '10px',
            borderBottom: '1px solid #ccc',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#333',
            textAlign: 'center',
            zIndex: 9999
        }}>
            <p style={{ margin: 0, padding: 0 }}><strong>[Temp Debug]</strong> NODE_ENV: <strong>{nodeEnv || 'not set'}</strong></p>
            <p style={{ margin: 0, padding: 0 }}><strong>[Temp Debug]</strong> user-auth-token: {sessionCookie ? `Found (Value starts with: ${sessionCookie.value.substring(0, 20)}...)` : <strong style={{color: 'red'}}>NOT FOUND</strong>}</p>
        </div>
        <Providers>
          <Header />
          <StickyNav user={user} />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
          <AppInstallPrompt />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
