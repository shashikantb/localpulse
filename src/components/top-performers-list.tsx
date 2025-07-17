
import { Suspense } from 'react';
import { getTopLpPointUsers } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Award, Medal, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';

async function TopPerformersContent() {
  const users = await getTopLpPointUsers();

  if (users.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>No point data available yet.</p>
      </div>
    );
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Trophy className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Trophy className="h-5 w-5 text-amber-700" />;
      default:
        return <Medal className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <ScrollArea className="h-72">
        <div className="overflow-x-auto">
            <div className="space-y-2 pr-4 min-w-max">
                {users.map((user, index) => (
                <Link href={`/users/${user.id}`} key={user.id} className="block p-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-8 text-base font-bold flex-shrink-0">
                        {getRankIcon(index)}
                        <span className="text-muted-foreground">{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary font-bold text-sm flex-shrink-0 w-16">
                        <Award className="h-4 w-4" />
                        <span>{user.lp_points}</span>
                    </div>
                    <Avatar className="h-10 w-10 border-2 border-primary/20 flex-shrink-0">
                        <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
                    </div>
                    </div>
                </Link>
                ))}
            </div>
        </div>
    </ScrollArea>
  );
}

const TopPerformersListSkeleton = () => (
    <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </div>
        ))}
    </div>
);

// Main component using Suspense
export default function TopPerformersList() {
  return (
    <Suspense fallback={<TopPerformersListSkeleton />}>
      <TopPerformersContent />
    </Suspense>
  );
}

// Expose the skeleton as a static property
TopPerformersList.Skeleton = TopPerformersListSkeleton;
