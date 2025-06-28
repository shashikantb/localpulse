'use client';

import type { User } from '@/lib/db-types';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

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
  // This client component wrapper allows the parent (Header) to remain a Server Component
  // while still dynamically loading the UserNav without server-side rendering.
  return <UserNav user={user} />;
}
