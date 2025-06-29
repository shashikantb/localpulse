
'use client';

import type { User } from '@/lib/db-types';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

// Dynamically import UserNav with SSR disabled. This is the correct pattern
// for using ssr:false, as it's now inside a Client Component.
const UserNav = dynamic(() => import('./user-nav').then((mod) => mod.UserNav), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-10 rounded-full" />,
});

interface HeaderUserNavProps {
  user: User | null;
}

export default function HeaderUserNav({ user }: HeaderUserNavProps) {
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
  return <UserNav user={user} />;
}
