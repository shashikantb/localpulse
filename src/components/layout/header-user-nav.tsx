
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import UserNav with SSR disabled.
// This component now just ensures UserNav is loaded on the client-side.
const UserNav = dynamic(() => import('./user-nav').then((mod) => mod.UserNav), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-10 rounded-full" />,
});

export default function HeaderUserNav() {
  // Always render the UserNav component, which will now appear in the header for both mobile and desktop.
  return <UserNav />;
}
