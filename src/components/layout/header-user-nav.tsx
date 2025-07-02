
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

// Dynamically import UserNav with SSR disabled.
const UserNav = dynamic(() => import('./user-nav').then((mod) => mod.UserNav), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-10 rounded-full" />,
});

export default function HeaderUserNav() {
  const isMobile = useIsMobile();

  // During SSR or before the hook determines the screen size, render a skeleton.
  if (isMobile === undefined) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  // If it's mobile, don't render the header navigation.
  if (isMobile) {
    return null;
  }

  // Otherwise, render the user navigation for desktop.
  return <UserNav />;
}
