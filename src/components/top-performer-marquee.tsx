
import { getTopLpPointUsers } from '@/app/actions';
import { Trophy, Award } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default async function TopPerformerMarquee() {
  const users = await getTopLpPointUsers();
  const topUser = users?.[0];

  if (!topUser) {
    return null; // Don't render anything if there are no users
  }

  return (
    <div className="relative flex overflow-x-hidden group rounded-lg border bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 p-2 border-amber-500/30 shadow-inner">
      <Link href={`/users/${topUser.id}`} className="flex animate-marquee whitespace-nowrap items-center text-sm font-medium text-amber-800 dark:text-amber-300">
        <Trophy className="h-5 w-5 mx-3 text-yellow-500 flex-shrink-0" />
        <span className="font-bold">#1 Top Performer:</span>
        <span className="mx-2 text-foreground">{topUser.name}</span>
        <Award className="h-4 w-4 text-primary" />
        <span className="font-bold text-primary ml-1">{topUser.lp_points} LP</span>
      </Link>
      <Link href={`/users/${topUser.id}`} className="absolute top-0 flex animate-marquee2 whitespace-nowrap items-center h-full text-sm font-medium text-amber-800 dark:text-amber-300 p-2">
        <Trophy className="h-5 w-5 mx-3 text-yellow-500 flex-shrink-0" />
        <span className="font-bold">#1 Top Performer:</span>
        <span className="mx-2 text-foreground">{topUser.name}</span>
        <Award className="h-4 w-4 text-primary" />
        <span className="font-bold text-primary ml-1">{topUser.lp_points} LP</span>
      </Link>
    </div>
  );
}
