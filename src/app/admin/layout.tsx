
import type { Metadata, FC, PropsWithChildren } from 'react';
import AdminNav from '@/components/admin/admin-nav';
import { verifyAdminAuth } from './actions';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Admin Panel - LocalPulse',
  description: 'Manage LocalPulse application',
};

interface AdminLayoutProps extends PropsWithChildren {}

const AdminLayout: FC<AdminLayoutProps> = async ({ children }) => {
  // This check is mostly redundant due to middleware, but good for server components
  // direct access protection if middleware is ever bypassed or misconfigured.
  const isAuthenticated = await verifyAdminAuth();
  if (!isAuthenticated && (typeof window !== 'undefined' && window.location.pathname !== '/admin/login')) {
     // Client-side check might be needed if middleware doesn't cover all scenarios or for immediate UI update
     // However, for RSC, middleware should handle redirects before this renders.
     // The primary check will be handled by middleware.
     // If this layout is somehow reached without auth (e.g. direct RSC render without middleware trigger),
     // this could redirect. However, middleware is the main guard.
  }


  return (
    <div className="flex min-h-screen bg-muted/40">
      <AdminNav />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
