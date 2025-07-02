
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Film, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSession } from '@/app/auth/actions';
import type { User } from '@/lib/db-types';
import { Skeleton } from '@/components/ui/skeleton';

const LoadingSkeleton: FC = () => (
    <div className="container mx-auto flex h-14 max-w-2xl items-center justify-around px-4">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="flex h-full w-full flex-col items-center justify-center space-y-1 pt-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 w-12" />
            </div>
        ))}
    </div>
);


const StickyNav: FC = () => {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-side effect to fetch session data for dynamic link generation
    getSession().then(session => {
      setUser(session.user);
      setLoading(false);
    });
  }, [pathname]); // Re-fetch session data if the path changes

  const navItems = [
    { name: 'Home', href: '/', icon: Home, current: pathname === '/' },
    { name: 'Reels', href: '/reels', icon: Film, current: pathname === '/reels' },
    { 
      name: 'Profile', 
      href: user ? `/users/${user.id}` : '/login', 
      icon: UserIcon, 
      current: user ? pathname.startsWith(`/users/${user.id}`) : pathname === '/login' 
    }
  ];

  return (
    <nav className="sticky top-14 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="container mx-auto flex h-14 max-w-2xl items-center justify-around px-4">
            {navItems.map((item) => (
                <Link
                key={item.name}
                href={item.href}
                className={cn(
                    'flex h-full w-full flex-row items-center justify-center space-x-2 border-b-2 px-4 text-sm font-medium transition-colors sm:flex-col sm:space-x-0 sm:space-y-1 sm:pt-2',
                    item.current
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
                aria-current={item.current ? 'page' : undefined}
                >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                </Link>
            ))}
        </div>
      )}
    </nav>
  );
};

export default StickyNav;
