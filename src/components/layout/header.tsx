
import type { FC } from 'react';
import Link from 'next/link';
import { Rss } from 'lucide-react';
import { UserNav } from './user-nav';
import { getSession } from '@/app/auth/actions';

const Header: FC = async () => {
  const { user } = await getSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <Rss className="h-6 w-6 text-accent" />
            <span className="font-bold text-primary">
              LocalPulse
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center">
            <UserNav user={user} />
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
