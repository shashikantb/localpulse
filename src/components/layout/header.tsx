
import type { FC } from 'react';
import Link from 'next/link';
import { Rss } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/lib/db-types';

// Dynamically import the user nav to code-split it from the main bundle.
const HeaderUserNav = dynamic(() => import('./header-user-nav'), {
  loading: () => <Skeleton className="h-10 w-10 rounded-full" />,
});

interface HeaderProps {
  user: User | null;
}

const Header: FC<HeaderProps> = ({ user }) => {
  // The Header component now receives the user session as a prop.
  // It no longer needs to be async or fetch the session itself.

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <Rss className="h-6 w-6 text-accent" />
            <span className="font-bold text-primary">
              LocalPulse
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="hidden items-center sm:flex">
            <HeaderUserNav user={user} />
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
