
import type { Metadata } from 'next';
import Script from 'next/script';
import { GeistSans } from 'geist/font/sans';
import '@/app/globals.css';
import { Toaster } from '@/components/ui/toaster';
import Footer from '@/components/layout/footer';
import { AppInstallPrompt } from '@/components/app-install-prompt';
import Header from '@/components/layout/header';
import StickyNav from '@/components/sticky-nav';
import { Providers } from '@/app/providers';
import { getSession } from '@/app/auth/actions';
import FirebaseMessagingClient from '@/components/firebase-messaging-client';
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
  const userToken = cookies().get('user-auth-token')?.value;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        {/* Next.js will populate this head based on metadata and other conventions */}
      </head>
      <body className={`${GeistSans.variable} antialiased bg-background text-foreground flex flex-col min-h-svh`}>
        <Providers>
          <FirebaseMessagingClient />
          <Header />
          <StickyNav user={user} />
          <main className="flex-grow flex flex-col">
            {children}
          </main>
          <Footer />
          <AppInstallPrompt />
          <Toaster />
        </Providers>
        <Script id="auth-token-handler" strategy="beforeInteractive">
          {`
            (function() {
              try {
                const url = new URL(window.location.href);
                const token = url.searchParams.get('_authtoken');
                if (token) {
                  console.log('Auth token found in URL, setting cookie...');
                  const d = new Date();
                  d.setTime(d.getTime() + (10 * 365 * 24 * 60 * 60 * 1000)); // 10 years
                  const expires = "expires=" + d.toUTCString();
                  document.cookie = "user-auth-token=" + token + ";" + expires + ";path=/;SameSite=Lax;Secure";
                  
                  // Clean the URL and reload
                  url.searchParams.delete('_authtoken');
                  window.location.replace(url.toString());
                }
              } catch (e) {
                console.error('Error handling auth token:', e);
              }
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
