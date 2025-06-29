
import type { Metadata, FC, PropsWithChildren } from 'react';
import AdminNav from '@/components/admin/admin-nav';
import { verifyAdminAuth } from '../actions'; // Path relative to src/app/admin/(authed)/
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Admin Panel - LocalPulse',
  description: 'Manage LocalPulse application',
};

interface AdminLayoutProps extends PropsWithChildren {}

const AuthedAdminLayout: FC<AdminLayoutProps> = async ({ children }) => {
  const isAuthenticated = await verifyAdminAuth();
  if (!isAuthenticated) {
    // This is a server-side check. Middleware should ideally catch this first.
    // If middleware was bypassed or if this is a direct RSC render, this will redirect.
    redirect('/admin/login'); 
  }

  return (
    <div className="flex min-h-svh bg-muted/40">
      <AdminNav />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AuthedAdminLayout;
